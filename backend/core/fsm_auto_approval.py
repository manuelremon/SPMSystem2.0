"""
Auto-Approval FSM Integration
New function to add to fsm.py for Sprint 40

This function should be added to the fsm.py file after the cambiar_estado function.
"""


def intentar_auto_aprobacion(solicitud_id: int, user_id: str = "sistema") -> Dict[str, Any]:
    """
    Attempt to auto-approve a solicitud based on configured rules.

    This function should be called when a solicitud is submitted.
    If auto-approval succeeds, the solicitud transitions to 'approved' state.

    Args:
        solicitud_id: Solicitud ID to evaluate
        user_id: User ID for audit trail (default: "sistema")

    Returns:
        {
            evaluado: bool,
            auto_aprobado: bool,
            regla_aplicada: str | None,
            confianza: float,
            motivo: str,
            resultado_fsm: dict | None
        }
    """
    try:
        from backend.services.auto_approval_service import AutoApprovalService

        # 1. Evaluate solicitud against rules
        evaluation = AutoApprovalService.evaluar_solicitud(solicitud_id)

        # 2. If not auto-approvable, return evaluation result
        if not evaluation.get("auto_aprobable"):
            logger.info(
                f"[FSM Auto-Approval] Solicitud {solicitud_id} not auto-approvable: "
                f"{evaluation.get('motivo')}"
            )
            return {
                "evaluado": True,
                "auto_aprobado": False,
                "regla_aplicada": None,
                "confianza": evaluation.get("confianza", 0.0),
                "motivo": evaluation.get("motivo", "No cumple reglas"),
                "resultado_fsm": None
            }

        # 3. Check confidence threshold (95%)
        confianza = evaluation.get("confianza", 0.0)
        if confianza < 0.95:
            logger.info(
                f"[FSM Auto-Approval] Solicitud {solicitud_id} confidence too low: "
                f"{confianza} < 0.95"
            )
            return {
                "evaluado": True,
                "auto_aprobado": False,
                "regla_aplicada": evaluation.get("regla_aplicada"),
                "confianza": confianza,
                "motivo": "Confianza insuficiente para auto-aprobar",
                "resultado_fsm": None
            }

        # 4. Auto-approve by calling cambiar_estado
        regla_aplicada = evaluation.get("regla_aplicada", "Regla desconocida")
        motivo = f"Auto-aprobada por regla: {regla_aplicada}"

        try:
            resultado_fsm = cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado="approved",
                actor_id=user_id,
                razon=motivo,
                metadata={
                    "auto_aprobado": True,
                    "regla_aplicada": regla_aplicada,
                    "confianza": confianza
                }
            )

            # 5. Create audit log entry
            with get_db_transaction() as conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO audit_logs
                    (event_type, user_id, entity_type, entity_id, description, metadata)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    "auto_approval",
                    user_id,
                    "solicitud",
                    solicitud_id,
                    motivo,
                    json.dumps({
                        "regla": regla_aplicada,
                        "confianza": confianza
                    })
                ))

            logger.info(
                f"[FSM Auto-Approval] Solicitud {solicitud_id} auto-approved by rule: "
                f"{regla_aplicada} (confidence: {confianza})"
            )

            return {
                "evaluado": True,
                "auto_aprobado": True,
                "regla_aplicada": regla_aplicada,
                "confianza": confianza,
                "motivo": motivo,
                "resultado_fsm": resultado_fsm
            }

        except Exception as e:
            logger.error(f"[FSM Auto-Approval] Failed to approve solicitud {solicitud_id}: {e}")
            return {
                "evaluado": True,
                "auto_aprobado": False,
                "regla_aplicada": regla_aplicada,
                "confianza": confianza,
                "motivo": f"Error en aprobación: {str(e)}",
                "resultado_fsm": None
            }

    except Exception as e:
        logger.error(f"[FSM Auto-Approval] Error evaluating solicitud {solicitud_id}: {e}")
        return {
            "evaluado": False,
            "auto_aprobado": False,
            "regla_aplicada": None,
            "confianza": 0.0,
            "motivo": f"Error en evaluación: {str(e)}",
            "resultado_fsm": None
        }
