import unittest
import os
import sys

# Ensure backend directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from descriptors import is_valid_smiles, get_molecular_descriptors, get_morgan_fingerprint
from ml_models import predict_bioactivity, get_available_targets

class TestCheminformaticsPipeline(unittest.TestCase):

    def setUp(self):
        # Standard test smiles (Aspirin)
        self.aspirin_smiles = "CC(=O)Oc1ccccc1C(=O)O"
        self.invalid_smiles = "C1C(=O)OXXXXX"

    def test_smiles_validation(self):
        self.assertTrue(is_valid_smiles(self.aspirin_smiles))
        self.assertFalse(is_valid_smiles(self.invalid_smiles))
        self.assertFalse(is_valid_smiles(""))
        self.assertFalse(is_valid_smiles(None))

    def test_descriptors_calculation(self):
        desc = get_molecular_descriptors(self.aspirin_smiles)
        self.assertIn("mw", desc)
        self.assertIn("logp", desc)
        self.assertIn("lipinski_violations", desc)
        self.assertIn("synthetic_accessibility", desc)
        
        # Aspirin properties checks:
        # MW = 180.16 g/mol, LogP = 1.19
        self.assertAlmostEqual(desc["mw"], 180.16, delta=1.0)
        self.assertLess(desc["logp"], 2.0)
        self.assertEqual(desc["lipinski_violations"], 0)
        self.assertTrue(desc["lipinski_pass"])

    def test_morgan_fingerprints(self):
        fp = get_morgan_fingerprint(self.aspirin_smiles, radius=2, n_bits=1024)
        self.assertEqual(len(fp), 1024)
        self.assertTrue(all(val in [0, 1] for val in fp))
        
        # Test active bits count is greater than zero
        self.assertGreater(sum(fp), 0)

    def test_predict_bioactivity_execution(self):
        # Test runs and computes predictions on trained target model
        try:
            pred = predict_bioactivity(self.aspirin_smiles, "COVID-19_Mpro")
            self.assertIn("status", pred)
            self.assertIn("probability_active", pred)
            self.assertIn("feature_contributions", pred)
            self.assertGreaterEqual(pred["probability_active"], 0.0)
            self.assertLessEqual(pred["probability_active"], 1.0)
        except FileNotFoundError:
            # If models are not trained yet, this test is skipped or will fail
            self.skipTest("Model files not found. Ensure models are trained first.")

if __name__ == "__main__":
    unittest.main()
