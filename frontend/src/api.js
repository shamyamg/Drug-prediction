/* ==========================================================================
   PharmAI API Client Library
   ========================================================================== */

const API_BASE_URL = "http://127.0.0.1:8000";

const ApiClient = {
    /**
     * Checks if the backend API is online.
     */
    async checkStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/`, { method: "GET", timeout: 3000 });
            if (response.ok) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    },

    /**
     * Fetches metadata for all trained machine learning target models.
     */
    async getTargets() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/targets`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Failed to fetch targets.");
            }
            return await response.json();
        } catch (e) {
            console.error("Error in getTargets:", e);
            throw e;
        }
    },

    /**
     * Predicts target bioactivity and calculates descriptors for a single compound SMILES.
     * @param {string} smiles 
     * @param {string} target 
     */
    async predict(smiles, target) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/predict`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ smiles, target })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Failed to predict compound bioactivity.");
            }
            return await response.json();
        } catch (e) {
            console.error("Error in predict:", e);
            throw e;
        }
    },

    /**
     * Runs virtual screening on a batch of SMILES.
     * @param {Array<string>} smilesList 
     * @param {string} target 
     */
    async screen(smilesList, target) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/screen`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ smiles_list: smilesList, target })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Screening request failed.");
            }
            return await response.json();
        } catch (e) {
            console.error("Error in screen:", e);
            throw e;
        }
    },

    /**
     * Uploads and screens a library file (CSV or TXT) containing SMILES.
     * @param {File} file 
     * @param {string} target 
     */
    async screenFile(file, target) {
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("target", target);
            
            const response = await fetch(`${API_BASE_URL}/api/screen-file`, {
                method: "POST",
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "File screening failed.");
            }
            return await response.json();
        } catch (e) {
            console.error("Error in screenFile:", e);
            throw e;
        }
    },

    /**
     * Looks up SMILES and properties for a drug name from PubChem.
     * @param {string} name 
     */
    async lookupCompound(name) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/lookup?name=${encodeURIComponent(name)}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Compound '${name}' not found.`);
            }
            return await response.json();
        } catch (e) {
            console.error("Error in lookupCompound:", e);
            throw e;
        }
    }
};

window.ApiClient = ApiClient;
