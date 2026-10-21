from app.engine.mapping import scan_control_status
from app.engine.scoring import compute_control_results, score


def machine(**kw):
    base = dict(os_supported=True, last_update_days=10, av_active=True, av_age_days=1, user_is_local_admin=False, is_laptop=False, bitlocker=None)
    base.update(kw)
    return {"machine": base}


def status(devices=None, m365=None):
    return scan_control_status(devices or [], m365)


# ---------------------------------------------------------------- C04 antivírus
def test_c04_tiers():
    assert status([machine()] * 5)["C04"] == "atende"
    four_of_five = [machine()] * 4 + [machine(av_active=False)]
    assert status(four_of_five)["C04"] == "parcial"  # 80%
    assert status([machine()] * 3 + [machine(av_active=False)] * 2)["C04"] == "nao_atende"
    assert status([machine(av_age_days=9)])["C04"] == "nao_atende"  # assinatura velha (>= 7 dias)
    assert status([machine(av_age_days=6)])["C04"] == "atende"


def test_unknown_values_are_left_out_and_all_unknown_gives_no_status():
    assert status([machine(av_active=None, av_age_days=None)]).get("C04") is None
    assert status([machine(), machine(av_active=None, av_age_days=None)])["C04"] == "atende"


# ---------------------------------------------------------------- C05 atualizações
def test_c05_needs_supported_os_and_recent_update():
    assert status([machine()])["C05"] == "atende"
    assert status([machine(os_supported=False)])["C05"] == "nao_atende"
    assert status([machine(last_update_days=45)])["C05"] == "nao_atende"
    assert status([machine(last_update_days=44)])["C05"] == "atende"


# ---------------------------------------------------------------- C09 administradores
def test_c09_local_admin_tiers():
    assert status([machine()] * 5)["C09"] == "atende"
    assert status([machine()] * 4 + [machine(user_is_local_admin=True)])["C09"] == "parcial"  # 20%
    assert status([machine()] * 3 + [machine(user_is_local_admin=True)] * 2)["C09"] == "nao_atende"


def test_c09_m365_global_admins_and_worst_source_wins():
    assert status(m365={"users_total": 10, "users_with_mfa": 10, "admins_global": 3, "admins_without_mfa": 0})["C09"] == "atende"
    assert status(m365={"users_total": 10, "users_with_mfa": 10, "admins_global": 5, "admins_without_mfa": 0})["C09"] == "parcial"
    assert status(m365={"users_total": 10, "users_with_mfa": 10, "admins_global": 7, "admins_without_mfa": 0})["C09"] == "nao_atende"
    assert status(m365={"users_total": 10, "users_with_mfa": 10, "admins_global": 1, "admins_without_mfa": 0})["C09"] == "nao_atende"
    # M365 fine but every PC has a local admin user -> the worst one wins
    both = status([machine(user_is_local_admin=True)] * 3, {"users_total": 5, "users_with_mfa": 5, "admins_global": 3, "admins_without_mfa": 0})
    assert both["C09"] == "nao_atende"


# ---------------------------------------------------------------- C10 criptografia
def test_c10_only_laptops_count_and_no_laptop_is_fine():
    assert status([machine(is_laptop=False)])["C10"] == "atende"
    assert status([machine(is_laptop=True, bitlocker=True)] * 2)["C10"] == "atende"
    assert status([machine(is_laptop=True, bitlocker=True)] * 4 + [machine(is_laptop=True, bitlocker=False)])["C10"] == "parcial"
    assert status([machine(is_laptop=True, bitlocker=False)])["C10"] == "nao_atende"
    assert status([machine(is_laptop=True, bitlocker=None)]).get("C10") is None  # sem admin o BitLocker não é legível


# ---------------------------------------------------------------- C03 MFA (Microsoft 365)
def test_c03_mfa_rules():
    ok = {"users_total": 10, "users_with_mfa": 10, "admins_global": 3, "admins_without_mfa": 0}
    assert status(m365=ok)["C03"] == "atende"
    assert status(m365={**ok, "users_with_mfa": 8})["C03"] == "parcial"
    assert status(m365={**ok, "users_with_mfa": 7})["C03"] == "nao_atende"
    assert status(m365={**ok, "admins_without_mfa": 1})["C03"] == "nao_atende"  # um admin sem MFA derruba
    assert "C03" not in status([machine()])  # sem M365 não há como dizer


def test_no_scan_data_means_no_statuses():
    assert scan_control_status([], None) == {}


# ---------------------------------------------------------------- scan manda mais que a resposta
ALL = [f"C{i:02d}" for i in range(1, 13)]


def test_scan_overrides_the_answer_and_flags_the_divergence():
    answers = {c: "sim" for c in ALL}
    rows = {r["control_id"]: r for r in compute_control_results(answers, {"C04": "nao_atende", "C05": "atende"})}
    assert rows["C04"] == {"control_id": "C04", "status": "nao_atende", "source": "scan", "divergence": True}
    assert rows["C05"]["source"] == "scan" and rows["C05"]["divergence"] is False  # scan e resposta concordam
    assert rows["C01"] == {"control_id": "C01", "status": "atende", "source": "questionario", "divergence": False}


def test_dont_know_is_never_a_divergence_and_the_scan_fills_it_in():
    rows = {r["control_id"]: r for r in compute_control_results({c: "nao_sei" for c in ALL}, {"C04": "atende"})}
    assert rows["C04"]["status"] == "atende" and rows["C04"]["divergence"] is False and rows["C04"]["source"] == "scan"


def test_score_uses_the_scan_result():
    answers = {c: "sim" for c in ALL}
    plain = score(compute_control_results(answers))
    with_scan = score(compute_control_results(answers, {"C04": "nao_atende"}))
    assert plain == 100 and with_scan == 90  # C04 peso 2 de 20
