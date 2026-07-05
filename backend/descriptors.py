from rdkit import Chem
from rdkit.Chem import Descriptors, AllChem
import numpy as np

def is_valid_smiles(smiles: str) -> bool:
    """Checks if a SMILES string can be parsed by RDKit."""
    if not smiles or not isinstance(smiles, str):
        return False
    try:
        mol = Chem.MolFromSmiles(smiles.strip())
        return mol is not None
    except Exception:
        return False

def get_molecular_descriptors(smiles: str) -> dict:
    """Calculates chemical properties and Lipinski Rule of 5 violations."""
    mol = Chem.MolFromSmiles(smiles.strip())
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")
        
    mw = Descriptors.ExactMolWt(mol)
    logp = Descriptors.MolLogP(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    tpsa = Descriptors.TPSA(mol)
    rot_bonds = Descriptors.NumRotatableBonds(mol)
    
    # Calculate violations of Lipinski's Rule of 5
    violations = 0
    rules = []
    
    if mw > 500:
        violations += 1
        rules.append("MW > 500")
    if logp > 5:
        violations += 1
        rules.append("LogP > 5")
    if hbd > 5:
        violations += 1
        rules.append("H-Bond Donors > 5")
    if hba > 10:
        violations += 1
        rules.append("H-Bond Acceptors > 10")
        
    lipinski_pass = violations <= 1
    
    # Synthetic accessibility approximation (simple heuristic for resume weightage since full SAscore needs rdkit contrib files)
    # Scale from 1 (easy) to 10 (hard) based on size, rings, and rotatable bonds
    num_heavy_atoms = mol.GetNumHeavyAtoms()
    num_rings = mol.GetRingInfo().NumRings()
    sa_score = 1.0 + (num_heavy_atoms * 0.1) + (num_rings * 0.5) + (rot_bonds * 0.2)
    sa_score = min(10.0, max(1.0, sa_score))
    
    return {
        "smiles": smiles,
        "mw": round(mw, 2),
        "logp": round(logp, 2),
        "hbd": hbd,
        "hba": hba,
        "tpsa": round(tpsa, 2),
        "rotatable_bonds": rot_bonds,
        "lipinski_violations": violations,
        "lipinski_violations_list": rules,
        "lipinski_pass": lipinski_pass,
        "synthetic_accessibility": round(sa_score, 1)
    }

def get_morgan_fingerprint(smiles: str, radius: int = 2, n_bits: int = 1024) -> list:
    """Computes the 1024-bit Morgan Fingerprint (equivalent to ECFP4) of a molecule."""
    mol = Chem.MolFromSmiles(smiles.strip())
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius, nBits=n_bits)
    return list(fp)
