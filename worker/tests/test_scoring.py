from pathlib import Path

from app.engine.scoring import band, compute_control_results, score, top_gaps

ALL = [f"C{i:02d}" for i in range(1, 13)]


def test_catalog_copy_matches_docs():
    here = Path(__file__).resolve().parent.parent
    assert (here / "app/engine/base12.json").read_bytes() == (here.parent / "docs/BASE12.json").read_bytes()


def results(value: str):
    return compute_control_results({c: value for c in ALL})


def test_all_yes_is_100_and_all_no_is_0():
    assert score(results("sim")) == 100
    assert score(results("nao")) == 0


def test_dont_know_counts_zero_and_is_sem_dado():
    r = results("nao_sei")
    assert {x["status"] for x in r} == {"sem_dado"}
    assert score(r) == 0


def test_partial_is_half():
    # C04 (peso 2) parcial, o resto sim: 100 * (20 - 1) / 20 = 95
    answers = {c: "sim" for c in ALL} | {"C04": "parcial"}
    assert score(compute_control_results(answers)) == 95


def test_weights_from_catalog():
    # Only C03 (peso 3) answered yes; total weight is 20 -> round(100*3/20) = 15
    answers = {c: "nao" for c in ALL} | {"C03": "sim"}
    assert score(compute_control_results(answers)) == 15


def test_missing_or_invalid_answer_is_sem_dado():
    r = {x["control_id"]: x["status"] for x in compute_control_results({"C01": "parcial"})}  # C01 has no 'parcial'
    assert r["C01"] == "sem_dado"
    assert r["C02"] == "sem_dado"
    assert len(r) == 12


def test_result_rows_shape():
    row = compute_control_results({"C01": "sim"})[0]
    assert row == {"control_id": "C01", "status": "atende", "source": "questionario", "divergence": False}


def test_bands():
    assert band(0)["rotulo"] == "Exposta"
    assert band(39)["rotulo"] == "Exposta"
    assert band(40)["rotulo"] == "Em construção"
    assert band(70)["rotulo"] == "Boa base"
    assert band(90)["rotulo"] == "Madura"
    assert band(100)["rotulo"] == "Madura"


def test_top_gaps_ordered_by_weight_then_severity():
    answers = {c: "sim" for c in ALL} | {"C03": "nao", "C06": "parcial", "C01": "nao", "C02": "nao"}
    gaps = top_gaps(compute_control_results(answers))
    assert [g["id"] for g in gaps] == ["C03", "C06", "C01"]  # weights 3,3,1; nao before parcial at equal weight is not needed here
    assert gaps[0]["ficha"] and gaps[0]["por_que"]


def test_top_gaps_empty_when_all_ok():
    assert top_gaps(results("sim")) == []


# ---------------------------------------------------------------- exposição por tipo de ameaça
from app.engine.scoring import opportunities, threat_exposure  # noqa: E402


def exposure(answers, external=None):
    return {t["id"]: t["nivel"] for t in threat_exposure(compute_control_results(answers), external)}


def test_every_control_and_external_check_is_covered_by_some_threat():
    from app.engine.scoring import CATALOG

    covered_controls = {c for t in CATALOG["ameacas"] for c in t["controles"]}
    covered_checks = {x for t in CATALOG["ameacas"] for x in t["checagens"]}
    assert covered_controls == set(ALL)
    assert covered_checks == {c["id"] for c in CATALOG["checagens_externas"]}


def test_all_no_is_high_everywhere_controls_cover_and_all_yes_is_low():
    all_fail = {x: "falha" for x in ["X01", "X02", "X03", "X04", "X05", "X06"]}
    assert set(exposure({c: "nao" for c in ALL}, all_fail).values()) == {"Alto"}
    assert set(exposure({c: "sim" for c in ALL}, {"X01": "ok", "X02": "ok", "X03": "ok", "X04": "ok", "X05": "ok", "X06": "ok"}).values()) == {"Baixo"}


def test_levels_follow_the_thresholds():
    # ransomware = C04(2) C05(2) C06(3) C07(2): all yes except C06 'nao' -> 6/9 = 67 -> Médio
    answers = {c: "sim" for c in ALL} | {"C06": "nao"}
    assert exposure(answers)["ransomware"] == "Médio"
    # C06 and C07 both no -> 4/9 = 44 -> Médio ; plus C04 no -> 2/9 = 22 -> Alto
    assert exposure({c: "sim" for c in ALL} | {"C06": "nao", "C07": "nao", "C04": "nao"})["ransomware"] == "Alto"


def test_dont_know_counts_as_zero_for_controls():
    assert exposure({c: "nao_sei" for c in ALL})["ransomware"] == "Alto"


def test_external_only_threat_uses_scan_and_ignores_no_data():
    answers = {c: "sim" for c in ALL}
    assert exposure(answers, {"X01": "falha", "X02": "falha", "X03": "sem_dado"})["falsificacao_dominio"] == "Alto"
    assert exposure(answers, {"X01": "ok", "X02": "parcial", "X03": "sem_dado"})["falsificacao_dominio"] == "Médio"  # (1+1)/(3) = 67
    assert exposure(answers, None)["falsificacao_dominio"] == "Sem dado"
    assert exposure(answers, {"X01": "sem_dado", "X02": "sem_dado", "X03": "sem_dado"})["falsificacao_dominio"] == "Sem dado"


def test_threats_are_sorted_most_exposed_first_and_have_texts():
    out = threat_exposure(compute_control_results({c: "sim" for c in ALL} | {"C03": "nao", "C09": "nao", "C11": "nao"}), None)
    assert out[0]["id"] == "fraude_email" and out[0]["nivel"] == "Alto"
    assert all(t["como_acontece"] and t["prejuizo"] for t in out)
    assert len(opportunities()) == 4
