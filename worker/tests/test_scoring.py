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
