Click here to visit website :https://drug-prediction-tp4b.vercel.app/
# PharmAI: ML-Powered Drug Discovery & Virtual Screening Platform

**PharmAI** is a machine learning-based computer-aided drug discovery (CADD) platform designed for virtual high-throughput screening and molecular analysis. This project simulates the early-stage pipeline of discovering active chemical agents (ligands) against key disease therapeutic target proteins.

---

## 🌟 Key Features

1. **AI Bioactivity Predictor**:
   - Classifies compound candidacy as *Active* or *Inactive* against specific disease targets using a Random Forest model.
   - Outputs confidence probability gauges indicating binding/inhibition likelihood.

2. **Therapeutic Targets Supported**:
   - **SARS-CoV-2 Main Protease (Mpro)**: COVID-19 replication inhibitor screening (`CHEMBL4523582`).
   - **Acetylcholinesterase (AChE)**: Alzheimer's symptom treatment screening (`CHEMBL220`).
   - **EGFR (Kinase)**: Lung cancer drug candidate screening (`CHEMBL203`).

3. **ADMET & Drug-Likeness Profiling**:
   - Assesses compound adherence to **Lipinski's Rule of 5** (Molecular Weight, Octanol-water partition coefficient $LogP$, Hydrogen Bond Donors, Hydrogen Bond Acceptors).
   - Computes chemical Synthetic Accessibility (SA Score heuristic) determining synthesis complexity.

4. **Explainable AI (XAI)**:
   - Uses perturbation-based *Leave-One-Out* analysis on the 1024-bit Morgan Fingerprint space to calculate which molecular substructures contributed most to the active prediction.
   - Visualized using horizontal bar charts.

5. **2D & 3D Molecule Visualizer**:
   - Draws clean 2D schematic layouts from SMILES strings client-side using `SmilesDrawer`.
   - Renders interactive, rotatable, and zoomable 3D ball-and-stick models in WebGL using `3Dmol.js` linked with real-time PubChem SDF coordinate APIs.

6. **Virtual Screening Portal**:
   - Allows upload of compound libraries (.csv or .txt containing lists of SMILES).
   - Processes batch molecules, sorts candidate structures by probability, and exports the optimized hitlist as a CSV file.

7. **PubChem Database Search Integration**:
   - Search common names (e.g. *Donepezil*, *Aspirin*, *Imatinib*) to fetch canonical SMILES, formulas, and structural metadata.

---

## 🛠️ Technology Stack

- **Backend / Machine Learning**:
  - `Python 3.14+`
  - `FastAPI` (REST API Web Framework)
  - `RDKit` (Cheminformatics Toolkit)
  - `scikit-learn` (Random Forest models, preprocessing, metrics evaluation)
  - `pandas` & `numpy` (Vector operations and tables)
  - `joblib` (Model serialization)
  - `requests` (API querying)

- **Frontend**:
  - `HTML5` (Semantic structure)
  - `CSS3` (Glassmorphism design, ambient glow, custom animations)
  - `Vanilla Javascript` (Asynchronous DOM state control, routing)
  - `Chart.js` (Horizontal contribution bar charts)
  - `3Dmol.js` (WebGL macromolecular viewer)
  - `SmilesDrawer` (SVG canvas molecular renderer)

---

## 📂 Project Directory Structure

```text
drug/
├── backend/
│   ├── app.py                 # FastAPI REST API controller
│   ├── descriptors.py         # Chemical calculations and RDKit fingerprinting
│   ├── ml_models.py           # Model loader and XAI perturbation logic
│   ├── train_models.py        # Model training script (ChEMBL ingestion + fallback)
│   └── models/                # Serialized model cache weights (.joblib, .json)
├── frontend/
│   ├── index.html             # Dashboard UI
│   └── src/
│       ├── index.css          # Glassmorphic premium CSS styles
│       ├── api.js             # Async API client
│       ├── mol_viewer.js      # 2D Canvas & 3D WebGL render bindings
│       └── ui.js              # DOM interactions, charts, upload controller
├── README.md                  # System Documentation
└── run.bat                    # Windows startup script launcher
```

---

## 🚀 How to Run the Project

### Prerequisites
Make sure Python is installed and the following dependencies are available. Open a command prompt and run:
```bash
pip install rdkit scikit-learn pandas numpy fastapi uvicorn joblib requests
```

### Starting the Platform
1. Double-click the **`run.bat`** script at the root directory of the project.
2. The controller will:
   - Run the training script to cache the machine learning models (if not already trained).
   - Launch the FastAPI server on `http://127.0.0.1:8000`.
   - Host the frontend on a local web server on `http://127.0.0.1:3000`.
   - Automatically open the dashboard in your default browser.
