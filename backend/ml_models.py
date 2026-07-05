import os
import json
import joblib
import numpy as np
from typing import Dict, List, Tuple
from descriptors import get_morgan_fingerprint, get_molecular_descriptors

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

# Cache for loaded models
_loaded_models = {}
_model_meta = {}

def get_model_and_meta(target_key: str) -> Tuple[object, dict]:
    """Loads and caches a model and its metadata."""
    if target_key in _loaded_models:
        return _loaded_models[target_key], _model_meta[target_key]
        
    model_path = os.path.join(MODELS_DIR, f"{target_key}.joblib")
    meta_path = os.path.join(MODELS_DIR, f"{target_key}_meta.json")
    
    if not os.path.exists(model_path) or not os.path.exists(meta_path):
        raise FileNotFoundError(f"Model files for {target_key} not found. Please run the training script first.")
        
    model = joblib.load(model_path)
    with open(meta_path, "r") as f:
        meta = json.load(f)
        
    _loaded_models[target_key] = model
    _model_meta[target_key] = meta
    
    return model, meta

def predict_bioactivity(smiles: str, target_key: str) -> dict:
    """Predicts active/inactive status and calculates descriptor/feature contributions."""
    model, meta = get_model_and_meta(target_key)
    
    # Calculate descriptors and fingerprint
    desc = get_molecular_descriptors(smiles)
    fp = get_morgan_fingerprint(smiles)
    
    # Run prediction
    fp_array = np.array([fp])
    prob_active = float(model.predict_proba(fp_array)[0][1])
    class_pred = int(model.predict(fp_array)[0])
    
    # Explainable AI: Feature Perturbation (Leave-One-Out Bit Analysis)
    # We find which bits are set to 1, turn them to 0 one-by-one, and check probability delta
    active_bits = [i for i, val in enumerate(fp) if val == 1]
    contributions = []
    
    # If the model has 1024 features, we test each active bit's impact
    # To prevent slow inference, we sample/limit if there are too many active bits, but for RF on 1024-bit 100 trees,
    # running predict_proba on a batch of perturbed fingerprints is extremely fast!
    if active_bits:
        perturbed_fps = []
        for bit in active_bits:
            fp_temp = list(fp)
            fp_temp[bit] = 0
            perturbed_fps.append(fp_temp)
            
        perturbed_probs = model.predict_proba(np.array(perturbed_fps))[:, 1]
        
        for idx, bit in enumerate(active_bits):
            prob_without_bit = perturbed_probs[idx]
            # Contribution: how much setting this bit to 1 increased/decreased the probability of being active
            contribution = prob_active - prob_without_bit
            contributions.append({
                "bit_index": bit,
                "contribution": round(float(contribution), 4)
            })
            
    # Sort contributions by absolute impact
    contributions = sorted(contributions, key=lambda x: abs(x["contribution"]), reverse=True)[:8]
    
    # Map class prediction to readable string
    status = "Active" if class_pred == 1 else "Inactive"
    
    # Suggest action based on outcome
    if status == "Active" and prob_active >= 0.75:
        action = "Strong Drug Candidate - Proceed to in-vitro testing"
    elif status == "Active":
        action = "Moderate Candidate - Optimize structure/substituents"
    else:
        action = "Unfavorable Candidate - Discard or complete scaffold re-design"
        
    return {
        "target_name": meta["target_name"],
        "chembl_id": meta["chembl_id"],
        "is_active": class_pred == 1,
        "status": status,
        "probability_active": round(prob_active, 4),
        "probability_inactive": round(1.0 - prob_active, 4),
        "recommended_action": action,
        "descriptors": desc,
        "feature_contributions": contributions,
        "model_accuracy": meta["metrics"]["accuracy"]
    }

def get_available_targets() -> List[dict]:
    """Returns metadata for all trained targets."""
    from train_models import TARGETS as config_targets
    targets_list = []
    for key in config_targets.keys():
        try:
            _, meta = get_model_and_meta(key)
            targets_list.append(meta)
        except Exception:
            # Model not trained yet, return basic config metadata
            targets_list.append({
                "target_key": key,
                "target_name": config_targets[key]["name"],
                "chembl_id": config_targets[key]["chembl_id"],
                "description": config_targets[key]["description"],
                "dataset_size": "Not trained",
                "metrics": None
            })
    return targets_list
