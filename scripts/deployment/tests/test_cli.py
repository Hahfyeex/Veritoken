from __future__ import annotations

import copy
import unittest
from typing import Any

from deployment.cli import validate_manifest_structure
from deployment.models import DeploymentError

SENSITIVE_VALUE = "SDO-NOT-ECHO-THIS-VALUE"


def valid_manifest() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "network": {"name": "testnet"},
        "contracts": {
            "kyc_registry": {
                "contract_id": "CKYC",
                "wasm_hash": "a" * 64,
                "artifact": {"path": "kyc_registry.wasm"},
            },
            "invoice-token": {
                "contract_id": "CINVOICE",
                "wasm_hash": "b" * 64,
                "artifact": {"path": "invoice_token.wasm"},
            },
        },
    }


class ValidateManifestStructureTest(unittest.TestCase):
    def test_valid_manifest_passes(self) -> None:
        contracts = validate_manifest_structure(valid_manifest())
        self.assertEqual(set(contracts), {"kyc_registry", "invoice-token"})

    def test_malformed_network_name_reports_json_path(self) -> None:
        manifest = valid_manifest()
        manifest["network"]["name"] = 42

        with self.assertRaises(DeploymentError) as ctx:
            validate_manifest_structure(manifest)

        self.assertIn("$.network.name", str(ctx.exception))

    def test_missing_contract_field_reports_json_path(self) -> None:
        manifest = valid_manifest()
        del manifest["contracts"]["kyc_registry"]["wasm_hash"]

        with self.assertRaises(DeploymentError) as ctx:
            validate_manifest_structure(manifest)

        self.assertIn("$.contracts.kyc_registry.wasm_hash", str(ctx.exception))

    def test_non_identifier_contract_name_uses_bracket_path(self) -> None:
        manifest = valid_manifest()
        manifest["contracts"]["invoice-token"] = "not-an-object"

        with self.assertRaises(DeploymentError) as ctx:
            validate_manifest_structure(manifest)

        self.assertIn('$.contracts["invoice-token"]', str(ctx.exception))

    def test_errors_do_not_echo_field_values(self) -> None:
        cases = []
        bad_name = valid_manifest()
        bad_name["network"]["name"] = ""
        bad_name["network"]["rpc_url"] = SENSITIVE_VALUE
        cases.append(bad_name)
        unpaired = valid_manifest()
        unpaired["network"]["rpc_url"] = SENSITIVE_VALUE
        cases.append(unpaired)
        bad_record = valid_manifest()
        bad_record["contracts"]["kyc_registry"] = SENSITIVE_VALUE
        cases.append(bad_record)

        for manifest in cases:
            with self.subTest(manifest=copy.deepcopy(manifest)):
                with self.assertRaises(DeploymentError) as ctx:
                    validate_manifest_structure(manifest)
                self.assertNotIn(SENSITIVE_VALUE, str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
