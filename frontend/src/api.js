/* ==========================================================================
   PharmAI API Client Library
   Supports automatic production backend linking (Render & Localhost)
   ========================================================================== */

// Inbuilt Production Backend URL on Render
const DEFAULT_PRODUCTION_API_URL = "https://pharmai-backend-1si8.onrender.com";

const ApiClient = {
    /**
     * Retrieves current active API Base URL.
     */
    getBaseUrl() {
        const customUrl = localStorage.getItem("PHARMAI_API_URL");
        if (customUrl && customUrl.trim()) {
            return customUrl.trim().replace(/\/+$/, "");
        }
        
        // Auto-detect local environment
        const hostname = window.location.hostname;
        if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "") {
            return "http://127.0.0.1:8000";
        }
        
        // When deployed live on Vercel / internet, automatically use Render backend
        return DEFAULT_PRODUCTION_API_URL;
    },

    /**
     * Updates and saves the API Base URL.
     */
    setBaseUrl(url) {
        if (!url || !url.trim()) {
            localStorage.removeItem("PHARMAI_API_URL");
        } else {
            let cleanUrl = url.trim().replace(/\/+$/, "");
            if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
                cleanUrl = "https://" + cleanUrl;
            }
            localStorage.setItem("PHARMAI_API_URL", cleanUrl);
        }
    },

    /**
     * Internal helper to make fetch requests with configurable timeout.
     */
    async fetchWithTimeout(resource, options = {}) {
        const { timeout = 15000, ...fetchOptions } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(resource, {
                ...fetchOptions,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error("Request timed out. If using Render free tier, the backend might be waking up from sleep (can take up to 50s).");
            }
            throw error;
        }
    },

    /**
     * Checks if the backend API is online.
     */
    async checkStatus() {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await this.fetchWithTimeout(`${baseUrl}/`, { method: "GET", timeout: 5000 });
            if (response.ok) {
                return { online: true, url: baseUrl };
            }
            return { online: false, url: baseUrl };
        } catch (e) {
            return { online: false, url: this.getBaseUrl(), error: e.message };
        }
    },

    /**
     * Fetches metadata for all trained machine learning target models.
     */
    async getTargets() {
        const baseUrl = this.getBaseUrl();
        try {
            const response = await this.fetchWithTimeout(`${baseUrl}/api/targets`, { timeout: 15000 });
            if (!response.ok) {
                let errorMsg = "Failed to fetch targets.";
                try {
                    const error = await response.json();
                    errorMsg = error.detail || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
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
        const baseUrl = this.getBaseUrl();
        try {
            const response = await this.fetchWithTimeout(`${baseUrl}/api/predict`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ smiles, target }),
                timeout: 20000
            });
            
            if (!response.ok) {
                let errorMsg = "Failed to predict compound bioactivity.";
                try {
                    const error = await response.json();
                    errorMsg = error.detail || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
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
        const baseUrl = this.getBaseUrl();
        try {
            const response = await this.fetchWithTimeout(`${baseUrl}/api/screen`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ smiles_list: smilesList, target }),
                timeout: 60000
            });
            
            if (!response.ok) {
                let errorMsg = "Screening request failed.";
                try {
                    const error = await response.json();
                    errorMsg = error.detail || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
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
        const baseUrl = this.getBaseUrl();
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("target", target);
            
            const response = await this.fetchWithTimeout(`${baseUrl}/api/screen-file`, {
                method: "POST",
                body: formData,
                timeout: 90000
            });
            
            if (!response.ok) {
                let errorMsg = "File screening failed.";
                try {
                    const error = await response.json();
                    errorMsg = error.detail || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
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
        const baseUrl = this.getBaseUrl();
        try {
            const response = await this.fetchWithTimeout(`${baseUrl}/api/lookup?name=${encodeURIComponent(name)}`, { timeout: 15000 });
            if (!response.ok) {
                let errorMsg = `Compound '${name}' not found.`;
                try {
                    const error = await response.json();
                    errorMsg = error.detail || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
            }
            return await response.json();
        } catch (e) {
            console.error("Error in lookupCompound:", e);
            throw e;
        }
    }
};

window.ApiClient = ApiClient;
