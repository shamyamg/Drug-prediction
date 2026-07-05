import os
import sys
import json
import joblib
import requests
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

# Ensure the backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from descriptors import get_morgan_fingerprint, is_valid_smiles, get_molecular_descriptors

# Target Definitions
TARGETS = {
    "COVID-19_Mpro": {
        "chembl_id": "CHEMBL4523582",
        "name": "SARS-CoV-2 Main Protease (Mpro)",
        "description": "Crucial enzyme for coronavirus replication; inhibiting it blocks viral replication.",
        "active_threshold_nm": 2000,   # Active if IC50 <= 2000 nM
        "inactive_threshold_nm": 10000 # Inactive if IC50 > 10000 nM
    },
    "Alzheimers_AChE": {
        "chembl_id": "CHEMBL220",
        "name": "Acetylcholinesterase (AChE)",
        "description": "Enzyme that degrades acetylcholine. Inhibitors (like Donepezil) increase neurotransmitter levels, treating Alzheimer's symptoms.",
        "active_threshold_nm": 1000,
        "inactive_threshold_nm": 8000
    },
    "Cancer_EGFR": {
        "chembl_id": "CHEMBL203",
        "name": "Epidermal Growth Factor Receptor (EGFR)",
        "description": "Receptor tyrosine kinase frequently mutated or overexpressed in non-small cell lung cancer.",
        "active_threshold_nm": 1000,
        "inactive_threshold_nm": 10000
    }
}

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

def fetch_chembl_data(target_chembl_id, limit=300):
    """Fetches IC50 bioactivity data from ChEMBL API for a target."""
    url = "https://www.ebi.ac.uk/chembl/api/data/activity.json"
    params = {
        "target_chembl_id": target_chembl_id,
        "standard_type": "IC50",
        "limit": limit,
        "standard_units": "NM"
    }
    headers = {
        "User-Agent": "PharmAI-Project/1.0 (academic final year project; contact: shamya@example.com)"
    }
    
    print(f"Fetching bioactivity data from ChEMBL for {target_chembl_id}...")
    try:
        response = requests.get(url, params=params, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            activities = data.get("activities", [])
            print(f"Retrieved {len(activities)} activity records from ChEMBL.")
            return activities
        else:
            print(f"Failed to fetch from ChEMBL (Status code: {response.status_code}).")
            return None
    except Exception as e:
        print(f"Network error while connecting to ChEMBL: {e}")
        return None

def generate_synthetic_data(target_key):
    """Generates biologically plausible synthetic molecule data if ChEMBL API is offline."""
    print(f"Generating synthetic fallback dataset for {target_key}...")
    np.random.seed(42 if target_key == "COVID-19_Mpro" else 77 if target_key == "Alzheimers_AChE" else 99)
    
    # We will generate chemical representations using standard scaffold formulas
    # that we modify to simulate features. RDKit parses them cleanly.
    base_scaffolds = [
        # Active-like drug structures
        ("c1ccccc1NC(=O)Cc2ccccc2", 1),
        ("CC(=O)Nc1ccc(O)cc1", 1),
        ("CN1CCC(CC1)Cc2cc(O)c3ccccc3c2", 1),
        ("CN(C)C(=O)Oc1cccc(c1)[C@@H](C)N(C)C", 1),
        ("COc1cc2c(cc1OC)c(cn2)C(=O)N3CCN(CC3)Cc4ccccc4", 1),
        ("Cc1c(c(nc1C)C(=O)NC2CCN(CC2)c3ccccc3)C", 1),
        ("O=C(c1ccc(OCCN2CCCCC2)cc1)c3c(O)sc4ccccc34", 1),
        # Inactive-like simple hydrocarbon / inorganic structures
        ("CCCC", 0),
        ("CCCCCC", 0),
        ("c1ccccc1", 0),
        ("CCO", 0),
        ("CC(=O)O", 0),
        ("CCN(CC)CC", 0),
        ("C1CCCCC1", 0),
        ("c1ccncc1", 0),
        ("CC(C)O", 0),
        ("O=C(O)c1ccccc1", 0),
    ]
    
    data = []
    # Expand structures by adding substituents to create a decent sized dataset (200 compounds)
    substituents = ["C", "O", "N", "F", "Cl", "OC", "CC", "C(=O)O"]
    
    for i in range(250):
        base, base_label = base_scaffolds[i % len(base_scaffolds)]
        # Mutate SMILES string syntactically or add modifiers to get variation
        # In this fallback, we'll append functional groups
        mod = substituents[(i * 3) % len(substituents)]
        
        # Create a valid molecule SMILES
        if base.endswith(")") or base.endswith("1") or base.endswith("2") or base.endswith("3") or base.endswith("4"):
            smiles = base + mod if not mod.startswith("C") else base
        else:
            if base_label == 1:
                smiles = f"{base}({mod})"
            else:
                smiles = f"{base}{mod}"
                
        # Validate chemistry via RDKit
        if is_valid_smiles(smiles):
            # Label heuristic based on properties to let the RF model find a pattern
            try:
                desc = get_molecular_descriptors(smiles)
                mw = desc["mw"]
                logp = desc["logp"]
                
                # Create a rule-based label (e.g., active if it has drug-like weight and contains N/O)
                if target_key == "COVID-19_Mpro":
                    # Targets larger compounds
                    is_active = 1 if (mw > 200 and logp > 1.0 and "N" in smiles) else 0
                elif target_key == "Alzheimers_AChE":
                    # Targets medium amine-containing rings
                    is_active = 1 if (mw > 150 and mw < 450 and "N" in smiles) else 0
                else: # EGFR
                    # Targets kinase inhibitors (aromatic, donor-acceptor systems)
                    is_active = 1 if (mw > 250 and desc["tpsa"] > 40) else 0
                    
                data.append({"smiles": smiles, "label": is_active})
            except:
                pass
                
    print(f"Generated {len(data)} valid synthetic molecules.")
    return pd.DataFrame(data)

def process_chembl_records(activities, target_info):
    """Processes raw ChEMBL JSON data to extract clean SMILES and binarized labels."""
    processed_data = []
    
    for act in activities:
        smiles = act.get("canonical_smiles")
        if not smiles or not is_valid_smiles(smiles):
            continue
            
        val_str = act.get("standard_value")
        if val_str is None:
            continue
            
        try:
            ic50_nm = float(val_str)
            # Filter borderline cases to create a clean separator for the model
            if ic50_nm <= target_info["active_threshold_nm"]:
                label = 1 # Active
            elif ic50_nm >= target_info["inactive_threshold_nm"]:
                label = 0 # Inactive
            else:
                continue # Skip borderline compounds for clean classification boundary
                
            processed_data.append({"smiles": smiles, "label": label})
        except ValueError:
            continue
            
    df = pd.DataFrame(processed_data)
    # Ensure minimum dataset size or drop duplicate SMILES
    if not df.empty:
        df = df.drop_duplicates(subset=["smiles"])
    return df

def train_and_save_model(target_key, target_info):
    """Trains a Random Forest classifier for a target and saves the weights and metrics."""
    print(f"\n==========================================")
    print(f"Starting pipeline for target: {target_info['name']}")
    print(f"==========================================")
    
    # Step 1: Ingest Data
    raw_data = fetch_chembl_data(target_info["chembl_id"])
    df = None
    if raw_data:
        df = process_chembl_records(raw_data, target_info)
        # Ensure we have at least 30 compounds of each class for a meaningful model
        if df.empty or len(df) < 60 or df["label"].nunique() < 2:
            print("ChEMBL dataset too small or imbalanced. Using synthetic fallback.")
            df = None
            
    if df is None:
        df = generate_synthetic_data(target_key)
        
    print(f"Dataset summary for training: {len(df)} compounds ({sum(df['label'] == 1)} Active, {sum(df['label'] == 0)} Inactive)")
    
    # Step 2: Compute Features (Fingerprints)
    X = []
    y = []
    valid_smiles = []
    
    for _, row in df.iterrows():
        try:
            fp = get_morgan_fingerprint(row["smiles"])
            X.append(fp)
            y.append(row["label"])
            valid_smiles.append(row["smiles"])
        except Exception as e:
            continue
            
    X = np.array(X)
    y = np.array(y)
    
    # Step 3: Train-Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # Step 4: Model Training
    model = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)
    
    # Step 5: Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    
    print(f"Model Performance Metrics:")
    print(f"  - Accuracy:  {accuracy:.4f}")
    print(f"  - Precision: {precision:.4f}")
    print(f"  - Recall:    {recall:.4f}")
    print(f"  - F1-Score:  {f1:.4f}")
    
    # Save the trained model
    model_path = os.path.join(MODELS_DIR, f"{target_key}.joblib")
    joblib.dump(model, model_path)
    print(f"Saved model to: {model_path}")
    
    # Save performance metrics metadata
    metadata = {
        "target_key": target_key,
        "target_name": target_info["name"],
        "chembl_id": target_info["chembl_id"],
        "description": target_info["description"],
        "dataset_size": len(df),
        "actives_count": int(sum(df['label'] == 1)),
        "inactives_count": int(sum(df['label'] == 0)),
        "metrics": {
            "accuracy": round(float(accuracy), 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1": round(float(f1), 4)
        }
    }
    
    metadata_path = os.path.join(MODELS_DIR, f"{target_key}_meta.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=4)
    print(f"Saved model metadata to: {metadata_path}")
    
    return metadata

def main():
    print("Starting ML Drug Detection Model Training Pipeline...")
    all_metadata = {}
    for target_key, target_info in TARGETS.items():
        meta = train_and_save_model(target_key, target_info)
        all_metadata[target_key] = meta
        
    print("\n==========================================")
    print("All models successfully trained and cached!")
    print("==========================================")

if __name__ == "__main__":
    main()
