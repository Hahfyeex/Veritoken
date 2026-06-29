#![cfg(test)]

use crate::{CarbonCreditToken, CarbonCreditTokenClient, ProjectMeta};
use compliance_engine::{ComplianceEngine, ComplianceEngineClient};
use kyc_registry::{KycRegistry, KycRegistryClient};
use soroban_sdk::{testutils::{Address as _, Events as _}, Address, Env, IntoVal, String};
extern crate alloc;

struct Harness {
    env: Env,
    token: CarbonCreditTokenClient<'static>,
    kyc: KycRegistryClient<'static>,
    compliance: ComplianceEngineClient<'static>,
    verifier: Address,
    admin: Address,
}

fn meta(env: &Env) -> ProjectMeta {
    ProjectMeta {
        project_id: String::from_str(env, "VCS-1234"),
        standard: String::from_str(env, "VCS"),
        vintage_year: 2024,
        project_name: String::from_str(env, "Amazon Reforestation"),
        project_type: String::from_str(env, "forestry"),
        country: String::from_str(env, "BR"),
        verifier: String::from_str(env, "Verra"),
        ipfs_cert_hash: String::from_str(env, "Qm..."),
    }
}

fn setup() -> Harness {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let kyc_id = env.register(KycRegistry, ());
    let kyc = KycRegistryClient::new(&env, &kyc_id);
    kyc.initialize(&admin);
    let verifier = Address::generate(&env);
    kyc.add_verifier(&verifier);

    let compliance_id = env.register(ComplianceEngine, ());
    let compliance = ComplianceEngineClient::new(&env, &compliance_id);
    compliance.initialize(&admin, &kyc_id);

    // Carbon credit token — constructor args passed atomically at register time
    let token_id = env.register(
        CarbonCreditToken,
        (
            admin.clone(),
            kyc_id.clone(),
            compliance_id.clone(),
            meta(&env),
        ),
    );
    let token = CarbonCreditTokenClient::new(&env, &token_id);

    Harness {
        env,
        token,
        kyc,
        compliance,
        verifier,
        admin,
    }
}

impl Harness {
    fn approve_kyc(&self, addr: &Address) {
        self.kyc.approve(
            &self.verifier,
            addr,
            &1,
            &0,
            &String::from_str(&self.env, "US"),
        );
    }
}

#[test]
fn test_metadata() {
    let h = setup();
    assert_eq!(h.token.decimals(), 0);
    assert_eq!(h.token.symbol(), String::from_str(&h.env, "VTCC"));
    assert_eq!(h.token.get_meta().standard, String::from_str(&h.env, "VCS"));
    assert_eq!(h.token.total_supply(), 0);
    assert_eq!(h.token.total_retired(), 0);
}

#[test]
fn test_mint_and_transfer() {
    let h = setup();
    let alice = Address::generate(&h.env);
    let bob = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.approve_kyc(&bob);

    h.token.mint(&alice, &500);
    assert_eq!(h.token.balance(&alice), 500);
    assert_eq!(h.token.total_supply(), 500);

    h.token.transfer(&alice, &bob, &200);
    assert_eq!(h.token.balance(&alice), 300);
    assert_eq!(h.token.balance(&bob), 200);
}

#[test]
fn test_mint_rejects_blocklisted_recipient() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.compliance.add_to_blocklist(&alice);

    assert!(h.token.try_mint(&alice, &100).is_err());
}

#[test]
fn test_mint_rejects_when_compliance_paused() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.compliance.pause();

    assert!(h.token.try_mint(&alice, &100).is_err());
}

#[test]
fn test_transfer_requires_kyc() {
    let h = setup();
    let alice = Address::generate(&h.env);
    let bob = Address::generate(&h.env); // no KYC
    h.approve_kyc(&alice);
    h.token.mint(&alice, &100);
    assert!(h.token.try_transfer(&alice, &bob, &10).is_err());
}

#[test]
fn test_transfer_blocked_when_paused() {
    let h = setup();
    let alice = Address::generate(&h.env);
    let bob = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.approve_kyc(&bob);
    h.token.mint(&alice, &100);

    h.compliance.pause();
    assert!(h.token.try_transfer(&alice, &bob, &10).is_err());
}

#[test]
fn test_retire_records_receipt() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.token.mint(&alice, &100);

    let receipt = h.token.retire(
        &alice,
        &40,
        &String::from_str(&h.env, "Acme Corp 2024 offset"),
        &String::from_str(&h.env, "annual net-zero pledge"),
    );

    assert_eq!(receipt.amount, 40);
    assert_eq!(receipt.retiree, alice);
    assert_eq!(h.token.balance(&alice), 60);
    assert_eq!(h.token.total_supply(), 60);
    assert_eq!(h.token.total_retired(), 40);

    assert_eq!(h.token.retirement_count(), 1);
    let r = h.token.get_receipt(&0);
    assert_eq!(r.amount, 40);
    assert_eq!(r.retiree, alice);

}

#[test]
fn test_retire_blocked_when_paused() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.token.mint(&alice, &100);

    // Pausing the compliance engine must freeze all token operations, including
    // retirements (burns).
    h.compliance.pause();
    assert!(h
        .token
        .try_retire(
            &alice,
            &10,
            &String::from_str(&h.env, "Acme Corp 2024 offset"),
            &String::from_str(&h.env, "annual net-zero pledge"),
        )
        .is_err());

    // After unpausing, the retirement goes through.
    h.compliance.unpause();
    let receipt = h.token.retire(
        &alice,
        &10,
        &String::from_str(&h.env, "Acme Corp 2024 offset"),
        &String::from_str(&h.env, "annual net-zero pledge"),
    );
    assert_eq!(receipt.amount, 10);
    assert_eq!(h.token.balance(&alice), 90);
}

#[test]
fn test_retire_insufficient_balance() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.token.mint(&alice, &10);
    assert!(h
        .token
        .try_retire(
            &alice,
            &11,
            &String::from_str(&h.env, "x"),
            &String::from_str(&h.env, "y"),
        )
        .is_err());
}

#[test]
fn test_mint_twice_same_address_holder_count_is_one() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);

    h.token.mint(&alice, &100);
    h.token.mint(&alice, &50);

    assert_eq!(h.compliance.holder_count(), 1);
    assert_eq!(h.token.balance(&alice), 150);
}

#[test]
fn test_non_deployer_cannot_reinitialize() {
    let h = setup();
    let attacker = Address::generate(&h.env);
    let kyc_id = Address::generate(&h.env);
    let ce_id = Address::generate(&h.env);
    // initialize must always panic — the constructor has already run
    let result = h
        .token
        .try_initialize(&attacker, &kyc_id, &ce_id, &meta(&h.env));
    assert!(result.is_err());
}

// ── update_kyc_registry / update_compliance_engine tests ─────────────────────

#[test]
fn test_update_kyc_registry_admin_only() {
    let h = setup();
    let new_kyc = Address::generate(&h.env);

    // Non-admin: separate env, no auths mocked
    {
        let env2 = Env::default();
        let non_admin = Address::generate(&env2);
        let token_id2 = env2.register(
            CarbonCreditToken,
            (
                non_admin.clone(),
                Address::generate(&env2),
                Address::generate(&env2),
                meta(&env2),
            ),
        );
        let client2 = CarbonCreditTokenClient::new(&env2, &token_id2);
        assert!(client2.try_update_kyc_registry(&Address::generate(&env2)).is_err());
    }

    // Admin succeeds
    h.token.update_kyc_registry(&new_kyc);

    // Minting now fails because the new registry has no approvals
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice); // approved in OLD registry only
    assert!(h.token.try_mint(&alice, &10).is_err());
}

#[test]
fn test_update_compliance_engine_admin_only() {
    let h = setup();

    // Non-admin: separate env, no auths mocked
    {
        let env2 = Env::default();
        let non_admin = Address::generate(&env2);
        let token_id2 = env2.register(
            CarbonCreditToken,
            (
                non_admin.clone(),
                Address::generate(&env2),
                Address::generate(&env2),
                meta(&env2),
            ),
        );
        let client2 = CarbonCreditTokenClient::new(&env2, &token_id2);
        assert!(client2.try_update_compliance_engine(&Address::generate(&env2)).is_err());
    }

    // Deploy a second compliance engine and pause it
    let ce2_id = h.env.register(ComplianceEngine, ());
    let ce2 = ComplianceEngineClient::new(&h.env, &ce2_id);
    let dummy_kyc = h.env.register(kyc_registry::KycRegistry, ());
    ce2.initialize(&h.admin, &dummy_kyc);
    ce2.pause();

    // Admin can update
    h.token.update_compliance_engine(&ce2_id);

    // Mints through the paused engine are now blocked
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    assert!(h.token.try_mint(&alice, &10).is_err());
}

#[test]
fn test_to_certificate_json() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.token.mint(&alice, &50);

    h.token.retire(
        &alice,
        &30,
        &String::from_str(&h.env, "Acme Corp 2024"),
        &String::from_str(&h.env, "net-zero pledge"),
    );

    let json = h.token.to_certificate_json(&0);

    // Verify JSON contains required fields by checking byte content.
    let len = json.len() as usize;
    let mut buf = alloc::vec![0u8; len];
    json.copy_into_slice(&mut buf);
    let s = core::str::from_utf8(&buf).expect("valid utf8");

    assert!(s.contains("\"project_id\":\"VCS-1234\""));
    assert!(s.contains("\"standard\":\"VCS\""));
    assert!(s.contains("\"vintage_year\":2024"));
    assert!(s.contains("\"amount\":30"));
    assert!(s.contains("\"beneficiary\":\"Acme Corp 2024\""));
    assert!(s.contains("\"retirement_reason\":\"net-zero pledge\""));
    assert!(s.contains("\"retiree\":"));
    assert!(s.contains("\"timestamp\":"));
}

// ── project_type validation tests (#255) ─────────────────────────────────────

#[test]
#[should_panic]
fn test_invalid_project_type_panics_in_constructor() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let kyc_id = Address::generate(&env);
    let ce_id = Address::generate(&env);
    let mut bad_meta = meta(&env);
    bad_meta.project_type = String::from_str(&env, "nuclear");
    env.register(CarbonCreditToken, (admin, kyc_id, ce_id, bad_meta));
}

#[test]
fn test_valid_project_types_accepted_in_constructor() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    for pt in ["forestry", "renewable", "methane_capture"] {
        let kyc_id = env.register(KycRegistry, ());
        let kyc = KycRegistryClient::new(&env, &kyc_id);
        kyc.initialize(&admin);
        let compliance_id = env.register(ComplianceEngine, ());
        let compliance = ComplianceEngineClient::new(&env, &compliance_id);
        compliance.initialize(&admin, &kyc_id);
        let mut m = meta(&env);
        m.project_type = String::from_str(&env, pt);
        let token_id = env.register(CarbonCreditToken, (admin.clone(), kyc_id, compliance_id, m));
        let token = CarbonCreditTokenClient::new(&env, &token_id);
        assert_eq!(token.get_meta().project_type, String::from_str(&env, pt));
    }
}

#[test]
fn test_invalid_project_type_panics_in_update_meta() {
    let h = setup();
    let mut bad_meta = h.token.get_meta();
    bad_meta.project_type = String::from_str(&h.env, "coal");
    assert!(h.token.try_update_meta(&bad_meta).is_err());
}

#[test]
fn test_valid_project_type_accepted_in_update_meta() {
    let h = setup();
    let mut new_meta = h.token.get_meta();
    new_meta.project_type = String::from_str(&h.env, "renewable");
    h.token.update_meta(&new_meta);
    assert_eq!(h.token.get_meta().project_type, String::from_str(&h.env, "renewable"));
}

#[test]
fn test_update_compliance_engine_affects_transfers() {
    let h = setup();

    let alice = Address::generate(&h.env);
    let bob = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.approve_kyc(&bob);
    h.token.mint(&alice, &100);

    // Deploy and switch to a paused engine
    let ce2_id = h.env.register(ComplianceEngine, ());
    let ce2 = ComplianceEngineClient::new(&h.env, &ce2_id);
    let dummy_kyc = h.env.register(kyc_registry::KycRegistry, ());
    ce2.initialize(&h.admin, &dummy_kyc);
    ce2.pause();

    h.token.update_compliance_engine(&ce2_id);
    assert!(h.token.try_transfer(&alice, &bob, &10).is_err());
}

#[test]
fn test_version_returns_nonempty() {
    let h = setup();
    let v = h.token.version();
    assert!(v.len() > 0);
}

#[test]
fn test_vintage_year_boundaries_accepted() {
    let h = setup();
    let mut m = meta(&h.env);

    m.vintage_year = 1990;
    h.token.update_meta(&m);

    m.vintage_year = 2050;
    h.token.update_meta(&m);
}

#[test]
fn test_vintage_year_below_min_rejected() {
    let h = setup();
    let mut m = meta(&h.env);
    m.vintage_year = 1989;
    assert!(h.token.try_update_meta(&m).is_err());
}

#[test]
fn test_vintage_year_above_max_rejected() {
    let h = setup();
    let mut m = meta(&h.env);
    m.vintage_year = 2051;
    assert!(h.token.try_update_meta(&m).is_err());
}

#[test]
fn test_vintage_year_zero_rejected() {
    let h = setup();
    let mut m = meta(&h.env);
    m.vintage_year = 0;
    assert!(h.token.try_update_meta(&m).is_err());
}

// ── get_receipts pagination tests (#202) ─────────────────────────────────────

/// Helper: retire `amount` tokens from alice in the given harness.
fn do_retire(h: &Harness, alice: &Address, amount: i128) {
    h.token.retire(
        alice,
        &amount,
        &String::from_str(&h.env, "beneficiary"),
        &String::from_str(&h.env, "reason"),
    );
}

#[test]
fn test_get_receipts_pagination() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    // Mint enough to retire 5 times
    h.token.mint(&alice, &500);

    for amount in [10i128, 20, 30, 40, 50] {
        do_retire(&h, &alice, amount);
    }

    assert_eq!(h.token.retirement_count(), 5);

    // First page: start=0, limit=3 → indices 0,1,2
    let page1 = h.token.get_receipts(&0, &3);
    assert_eq!(page1.len(), 3);

    // Second page: start=3, limit=3 → indices 3,4 (only 2 remain)
    let page2 = h.token.get_receipts(&3, &3);
    assert_eq!(page2.len(), 2);
}

#[test]
fn test_get_receipts_limit_cap() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.token.mint(&alice, &200);

    // Retire only twice
    do_retire(&h, &alice, 50);
    do_retire(&h, &alice, 75);

    assert_eq!(h.token.retirement_count(), 2);

    // Requesting 200 items (> MAX_PAGE_SIZE=100) should still only return 2
    let results = h.token.get_receipts(&0, &200);
    assert_eq!(results.len(), 2);
}

#[test]
fn test_get_receipts_beyond_end_returns_empty() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.token.mint(&alice, &100);

    do_retire(&h, &alice, 10);

    assert_eq!(h.token.retirement_count(), 1);

    // start=5 is past the single receipt at index 0 → empty
    let results = h.token.get_receipts(&5, &10);
    assert_eq!(results.len(), 0);
}

#[test]
fn test_get_receipts_insertion_order() {
    let h = setup();
    let alice = Address::generate(&h.env);
    h.approve_kyc(&alice);
    h.token.mint(&alice, &300);

    let amounts = [10i128, 20, 30];
    for &amount in &amounts {
        do_retire(&h, &alice, amount);
    }

    assert_eq!(h.token.retirement_count(), 3);

    let receipts = h.token.get_receipts(&0, &10);
    assert_eq!(receipts.len(), 3);

    // Receipts must appear in insertion (retirement) order
    assert_eq!(receipts.get(0).unwrap().amount, 10);
    assert_eq!(receipts.get(1).unwrap().amount, 20);
    assert_eq!(receipts.get(2).unwrap().amount, 30);
}
