import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import requests
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import io
import pandas as pd

from descriptors import is_valid_smiles, get_molecular_descriptors
from ml_models import predict_bioactivity, get_available_targets

app = FastAPI(
    title="PharmAI - Drug Discovery & Bioactivity API",
    description="Machine learning API for predicting target bioactivity, calculating molecular descriptors, and virtual screening.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response validation
class PredictionRequest(BaseModel):
    smiles: str
    target: str

class ScreeningRequest(BaseModel):
    smiles_list: List[str]
    target: str

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "PharmAI API Engine",
        "endpoints": ["/api/targets", "/api/predict", "/api/screen", "/api/lookup"]
    }

@app.get("/api/targets")
def get_targets():
    """Returns available machine learning models, targets, and their metrics."""
    try:
        return get_available_targets()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving targets: {str(e)}")

@app.post("/api/predict")
def predict(request: PredictionRequest):
    """Predicts drug-target bioactivity and calculates descriptors for a single compound."""
    smiles = request.smiles.strip()
    target = request.target
    
    if not is_valid_smiles(smiles):
        raise HTTPException(status_code=400, detail="Invalid SMILES chemical representation.")
        
    try:
        prediction = predict_bioactivity(smiles, target)
        return prediction
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/api/screen")
def screen_compounds(request: ScreeningRequest):
    """Virtual screening of a list of compound SMILES against a target."""
    smiles_list = [s.strip() for s in request.smiles_list if s.strip()]
    target = request.target
    
    if not smiles_list:
        raise HTTPException(status_code=400, detail="Empty SMILES list provided.")
        
    results = []
    errors = 0
    
    for idx, smiles in enumerate(smiles_list):
        if not is_valid_smiles(smiles):
            errors += 1
            continue
        try:
            pred = predict_bioactivity(smiles, target)
            results.append({
                "id": idx + 1,
                "smiles": smiles,
                "mw": pred["descriptors"]["mw"],
                "logp": pred["descriptors"]["logp"],
                "lipinski_violations": pred["descriptors"]["lipinski_violations"],
                "synthetic_accessibility": pred["descriptors"]["synthetic_accessibility"],
                "probability_active": pred["probability_active"],
                "status": pred["status"]
            })
        except Exception:
            errors += 1
            
    # Sort by active probability descending (top candidate molecules first)
    results = sorted(results, key=lambda x: x["probability_active"], reverse=True)
    
    return {
        "target": target,
        "screened_count": len(smiles_list),
        "successful_count": len(results),
        "failed_count": errors,
        "results": results
    }

@app.post("/api/screen-file")
async def screen_file(
    target: str = Form(...),
    file: UploadFile = File(...)
):
    """Virtual screening using a CSV or TXT file containing a column of SMILES."""
    content = await file.read()
    
    # Try reading as CSV or TXT
    try:
        decoded = content.decode('utf-8')
        # Check if comma-separated or newline-separated
        if ',' in decoded.split('\n')[0]:
            df = pd.read_csv(io.StringIO(decoded))
            # Find a column containing SMILES (case insensitive check)
            smiles_col = None
            for col in df.columns:
                if 'smiles' in col.lower():
                    smiles_col = col
                    break
            if smiles_col is None:
                # Default to first column if no named column matches
                smiles_col = df.columns[0]
            smiles_list = df[smiles_col].dropna().astype(str).tolist()
        else:
            # Just plain lines of SMILES
            smiles_list = [line.strip() for line in decoded.split('\n') if line.strip()]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file structure: {str(e)}")
        
    # Reuse screening endpoint logic
    req = ScreeningRequest(smiles_list=smiles_list, target=target)
    return screen_compounds(req)

@app.get("/api/lookup")
def lookup_compound(name: str = Query(..., description="The compound common name, e.g. Aspirin")):
    """Queries PubChem API in real-time to retrieve the SMILES structure for a drug/compound name."""
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name.strip()}/property/CanonicalSMILES,MolecularFormula,MolecularWeight/JSON"
    try:
        response = requests.get(url, timeout=8)
        if response.status_code == 200:
            data = response.json()
            props = data["PropertyTable"]["Properties"][0]
            return {
                "name": name,
                "cid": props.get("CID"),
                "smiles": props.get("CanonicalSMILES"),
                "formula": props.get("MolecularFormula"),
                "mw": props.get("MolecularWeight")
            }
        elif response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Compound '{name}' not found in PubChem.")
        else:
            raise HTTPException(status_code=502, detail="Error communicating with PubChem database.")
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=503, detail="PubChem service unavailable.")
