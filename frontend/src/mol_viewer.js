/* ==========================================================================
   PharmAI Chemical Molecular Visualization Engine (2D Canvas & 3Dmol.js)
   ========================================================================== */

const MolViewer = {
    // Keep reference to the 3D viewer instance
    viewer3d: null,
    drawer2d: null,

    /**
     * Initializes the 2D canvas drawer.
     */
    initDrawer() {
        if (typeof SmilesDrawer !== 'undefined') {
            this.drawer2d = new SmilesDrawer.Drawer({
                width: 280,
                height: 200,
                theme: 'dark',
                bondThickness: 1.5,
                bondLength: 15,
                radicalColor: '#f43f5e'
            });
        }
    },

    /**
     * Renders a 2D layout representation of a SMILES formula on the canvas.
     * @param {string} smiles 
     * @param {string} canvasId 
     */
    render2D(smiles, canvasId = "mol2d-canvas") {
        if (!this.drawer2d) {
            this.initDrawer();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Clear canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!this.drawer2d) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.fillText("SmilesDrawer failed to load", 20, 100);
            return;
        }

        try {
            SmilesDrawer.parse(smiles, (tree) => {
                this.drawer2d.draw(tree, canvasId, "dark", false);
            }, (err) => {
                console.error("SmilesDrawer parse error:", err);
                this.drawFallback2D(ctx, smiles);
            });
        } catch (e) {
            console.error("2D Render error:", e);
            this.drawFallback2D(ctx, smiles);
        }
    },

    /**
     * Simple canvas text fallback if SMILES parsing fails.
     */
    drawFallback2D(ctx, smiles) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        // Wrap text if needed
        const maxLen = 30;
        let y = 90;
        for (let i = 0; i < smiles.length; i += maxLen) {
            ctx.fillText(smiles.substring(i, i + maxLen), 140, y);
            y += 18;
        }
    },

    /**
     * Resolves a SMILES string to its PubChem Compound ID (CID) dynamically.
     * @param {string} smiles 
     */
    async resolveSmilesToCid(smiles) {
        const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/cids/JSON`;
        try {
            const response = await fetch(url);
            if (response.ok) {
                const json = await response.json();
                const cid = json.IdentifierList.CID[0];
                return cid;
            }
            return null;
        } catch (e) {
            console.warn("PubChem SMILES to CID resolution failed:", e);
            return null;
        }
    },

    /**
     * Fetches and renders a 3D molecular conformation model in the browser container.
     * @param {string} smiles 
     * @param {number} optCid 
     */
    async render3D(smiles, optCid = null) {
        const container = document.getElementById("mol3d-viewer");
        if (!container) return;

        // Initialize 3Dmol viewer if it doesn't exist
        if (!this.viewer3d && typeof $3Dmol !== 'undefined') {
            this.viewer3d = $3Dmol.createViewer(container, {
                backgroundColor: '#0c0f17'
            });
        }

        if (!this.viewer3d) {
            container.innerHTML = "<div style='color:#64748b;padding:80px;text-align:center;'>3Dmol.js not available</div>";
            return;
        }

        this.viewer3d.clear();
        container.classList.remove("display-none");

        let cid = optCid;
        if (!cid) {
            container.innerHTML = "<div class='loading-spinner-center' style='color:#06b6d4;padding:80px;text-align:center;'><i class='fa-solid fa-circle-notch fa-spin'></i> Building 3D Conformation...</div>";
            cid = await this.resolveSmilesToCid(smiles);
        }

        if (!cid) {
            container.innerHTML = "<div style='color:#64748b;padding:70px 20px;text-align:center;font-size:12px;'><i class='fa-solid fa-triangle-exclamation'></i> 3D Conformation not found in PubChem database.</div>";
            return;
        }

        // Fetch 3D SDF coordinates from PubChem
        const sdfUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/SDF/?record_type=3d`;
        try {
            const res = await fetch(sdfUrl);
            if (!res.ok) throw new Error("SDF not found");
            const sdfText = await res.text();

            container.innerHTML = ""; // Clear loader text
            this.viewer3d.setContainer(container); // Rebind to clear custom html
            this.viewer3d.clear();
            
            this.viewer3d.addModel(sdfText, "sdf");
            
            // Set beautiful styling: stick model with sphere overlays for atoms (Jmol colors)
            this.viewer3d.setStyle({}, {
                stick: { colorscheme: "Jmol", radius: 0.15 },
                sphere: { scale: 0.22, colorscheme: "Jmol" }
            });
            
            this.viewer3d.zoomTo();
            this.viewer3d.render();
        } catch (e) {
            console.error("Error displaying 3D structure:", e);
            container.innerHTML = "<div style='color:#64748b;padding:70px 20px;text-align:center;font-size:12px;'><i class='fa-solid fa-triangle-exclamation'></i> Failed to load 3D SDF coordinates.</div>";
        }
    }
};

window.MolViewer = MolViewer;
