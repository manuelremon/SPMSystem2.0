"""
Tests del motor de scoring probabilístico
"""

from datetime import datetime, timedelta, timezone

from src.planner.scoring import (BaseScorer, CostBreakdown,
                                 CriticalityAwareScorer, FeatureExtractor,
                                 QualityRiskAssessment, ScoringContext,
                                 TimeRiskAssessment)


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


print("\n" + "=" * 70)
print("TESTS DEL MOTOR DE SCORING PROBABILÍSTICO (Todo #3)")
print("=" * 70 + "\n")

try:
    # Test 1: BaseScorer importa
    print("[Test 1] BaseScorer importa correctamente")
    scorer = BaseScorer()
    assert scorer is not None

    # Test 2: Crear context
    print("[Test 2] Crear ScoringContext")
    context = ScoringContext(
        required_date=utc_now() + timedelta(days=10),
        order_date=utc_now(),
        item_criticality="HIGH",
        item_abc="A",
        target_service_level=0.95,
    )
    assert context.days_to_deadline == 10

    # Test 3: TimeRiskAssessment
    print("[Test 3] TimeRiskAssessment calcula probabilidades")
    time_risk = TimeRiskAssessment(lead_time_mean=5, lead_time_std=2, on_time_percentage=0.95)
    prob_on_time = time_risk.calculate_probability_on_time(
        context.required_date, context.order_date
    )
    assert 0 <= prob_on_time <= 1
    print(f"   - P(on-time) = {prob_on_time:.1%}")

    # Test 4: SL lead time
    print("[Test 4] Calcular lead time para SL 95%")
    sl_lt = time_risk.calculate_service_level_lead_time(0.95)
    assert sl_lt > time_risk.lead_time_mean
    print(f"   - SL LT = {sl_lt:.1f} dias")

    # Test 5: Quality risk
    print("[Test 5] QualityRiskAssessment integrado")
    quality = QualityRiskAssessment(
        quality_acceptance_rate=0.99, availability_percentage=0.95, reliability_score=0.92
    )
    integrated = quality.integrated_reliability
    assert 0 < integrated < 1
    print(f"   - Integrated Reliability = {integrated:.3f}")

    # Test 6: Calculate CTE
    print("[Test 6] Calcular CTE para una opcion")
    cost = CostBreakdown(
        unit_cost=50.0, transportation_cost=10.0, customs_duty=5.0, handling_cost=2.0
    )
    cte = scorer.calculate_cte(
        option_id="OPT-001",
        item_id="MAT-001",
        cost_breakdown=cost,
        time_risk=time_risk,
        quality_risk=quality,
        context=context,
        sourcing_path="PURCHASE",
        supplier_id="SUP-001",
    )
    assert 0 <= cte.cte_value <= 1
    print(f"   - CTE = {cte.cte_value:.3f}")
    print(f"   - Cost Score = {cte.cost_score.value:.3f}")
    print(f"   - Time Score = {cte.time_score.value:.3f}")
    print(f"   - Risk Score = {cte.risk_score.value:.3f}")

    # Test 7: CriticalityAwareScorer
    print("[Test 7] CriticalityAwareScorer con reglas")
    crit_scorer = CriticalityAwareScorer()

    # Crear opciones de prueba
    options_data = [
        {
            "option_id": "OPT-001",
            "item_id": "MAT-001",
            "cost": 50.0,
            "transport": 10.0,
            "customs": 5.0,
            "handling": 2.0,
            "lead_time_mean": 5,
            "lead_time_std": 2,
            "on_time_pct": 0.95,
            "quality_rate": 0.99,
            "availability": 0.95,
            "reliability": 0.92,
            "sourcing_path": "PURCHASE",
            "supplier_id": "SUP-001",
        },
        {
            "option_id": "OPT-002",
            "item_id": "MAT-001",
            "cost": 45.0,
            "transport": 8.0,
            "customs": 4.0,
            "handling": 1.5,
            "lead_time_mean": 7,
            "lead_time_std": 3,
            "on_time_pct": 0.90,
            "quality_rate": 0.98,
            "availability": 0.93,
            "reliability": 0.90,
            "sourcing_path": "PURCHASE_IMPORT",
            "supplier_id": "SUP-002",
        },
    ]

    accepted, cut_results = crit_scorer.score_and_cut(options_data, context)
    assert len(accepted) > 0
    print(f"   - Opciones aceptadas: {len(accepted)}/{len(options_data)}")

    # Test 8: Feature Extraction
    print("[Test 8] FeatureExtractor genera features")
    feat_extractor = FeatureExtractor()

    fv = feat_extractor.extract_features(
        option_id="OPT-001",
        item_id="MAT-001",
        cost_data={
            "unit": 50.0,
            "transportation": 10.0,
            "customs": 5.0,
            "handling": 2.0,
        },
        time_data={
            "mean": 5,
            "std": 2,
            "on_time_pct": 0.95,
        },
        reliability_data={
            "quality": 0.99,
            "availability": 0.95,
            "reliability": 0.92,
        },
        context_data={
            "days_to_deadline": 10,
            "criticality": "HIGH",
            "demand_quantity": 100,
            "abc_class": "A",
        },
    )

    assert len(fv.features) > 0
    print(f"   - Features extraidas: {len(fv.features)}")

    # Test 9: Feature statistics
    print("[Test 9] Calcular estadisticas de features")
    feat_extractor.extract_features(
        option_id="OPT-002",
        item_id="MAT-001",
        cost_data={"unit": 45.0, "transportation": 8.0, "customs": 4.0, "handling": 1.5},
        time_data={"mean": 7, "std": 3, "on_time_pct": 0.90},
        reliability_data={"quality": 0.98, "availability": 0.93, "reliability": 0.90},
    )

    stats = feat_extractor.calculate_statistics("total_cost_per_unit")
    assert stats is not None
    print(f"   - Mean: {stats.mean:.2f}, Std: {stats.std_dev:.2f}")

    # Test 10: Report generation
    print("[Test 10] Generar reportes")
    print(f"\n{scorer.get_scoring_report()}")

    print("\n" + "=" * 70)
    print("TODOS LOS TESTS PASARON (10/10)")
    print("=" * 70 + "\n")

except Exception as e:
    print(f"\nERROR: {e}")
    import traceback

    traceback.print_exc()
    exit(1)
