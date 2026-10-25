from typing import Dict, Any, List, Optional
from fastapi import HTTPException


# Shared Status Constants
WORKFLOW_STAGES = [
    "DRAFT",
    "SUBMITTED",
    "SCRUTINY",
    "RE_SCRUTINY",
    "EVC_PENDING",
    "EVC_SCHEDULED",
    "EVC_COMPLETED",
    "SAC_SHC_REVIEW",
    "COMPLIANCE_PENDING",
    "COMPLETED",
    "RETURNED_FOR_CLARIFICATION"
]

APPLICATION_STATUSES = [
    "DRAFT",
    "IN_PROGRESS",
    "RETURNED",
    "OVERDUE",
    "COMPLETED",
    "REJECTED"
]

# Transition rules per stage
# Maps current_stage -> { action: { target_stage, target_status, allowed_roles, assigned_to, description } }
TRANSITION_RULES: Dict[str, Dict[str, Dict[str, Any]]] = {
    "DRAFT": {
        "SUBMIT": {
            "target_stage": "SCRUTINY",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["institution", "admin"],
            "assigned_to": "Regional Officer",
            "description": "Application submitted by institution for regulatory processing"
        }
    },
    "SUBMITTED": {
        "START_SCRUTINY": {
            "target_stage": "SCRUTINY",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Regional Officer",
            "description": "Scrutiny committee assigned for primary document inspection"
        },
        "RETURN": {
            "target_stage": "RETURNED_FOR_CLARIFICATION",
            "target_status": "RETURNED",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Institution",
            "description": "Returned to applicant for deficiency resolution"
        }
    },
    "SCRUTINY": {
        "SCRUTINY_PASS": {
            "target_stage": "COMPLIANCE_PENDING",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Regional Officer",
            "description": "Primary scrutiny cleared; awaiting compliance and undertaking verification"
        },
        "SEND_EVC": {
            "target_stage": "EVC_PENDING",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "EVC Coordinator",
            "description": "Referred to Expert Visiting Committee for physical infrastructure inspection"
        },
        "REQUIRE_RE_SCRUTINY": {
            "target_stage": "RE_SCRUTINY",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Senior Scrutinizer",
            "description": "Secondary scrutiny required for disputed credentials"
        },
        "RETURN": {
            "target_stage": "RETURNED_FOR_CLARIFICATION",
            "target_status": "RETURNED",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Institution",
            "description": "Returned due to document discrepancies"
        }
    },
    "RE_SCRUTINY": {
        "SCRUTINY_PASS": {
            "target_stage": "COMPLIANCE_PENDING",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Regional Officer",
            "description": "Re-scrutiny successfully cleared"
        },
        "SEND_EVC": {
            "target_stage": "EVC_PENDING",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "EVC Coordinator",
            "description": "Forwarded to EVC following re-scrutiny review"
        },
        "SEND_COMMITTEE": {
            "target_stage": "SAC_SHC_REVIEW",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Bureau Officer",
            "description": "Referred to Standing Appellate Committee"
        },
        "RETURN": {
            "target_stage": "RETURNED_FOR_CLARIFICATION",
            "target_status": "RETURNED",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Institution",
            "description": "Returned after re-scrutiny examination"
        }
    },
    "EVC_PENDING": {
        "SCHEDULE_EVC": {
            "target_stage": "EVC_SCHEDULED",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "evc_expert", "admin"],
            "assigned_to": "EVC Inspection Panel",
            "description": "EVC date confirmed and committee constituted"
        },
        "WAIVE_EVC": {
            "target_stage": "SAC_SHC_REVIEW",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["bureau", "admin"],
            "assigned_to": "Bureau Officer",
            "description": "Inspection waived under statutory exemption rules"
        },
        "RETURN": {
            "target_stage": "RETURNED_FOR_CLARIFICATION",
            "target_status": "RETURNED",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Institution",
            "description": "Clarification required prior to scheduling EVC"
        }
    },
    "EVC_SCHEDULED": {
        "COMPLETE_EVC": {
            "target_stage": "EVC_COMPLETED",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["evc_expert", "officer", "admin"],
            "assigned_to": "Regional Officer",
            "description": "EVC inspection successfully conducted and report filed"
        },
        "POSTPONE_EVC": {
            "target_stage": "EVC_PENDING",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["evc_expert", "officer", "admin"],
            "assigned_to": "EVC Coordinator",
            "description": "EVC visit postponed due to logistical constraints"
        }
    },
    "EVC_COMPLETED": {
        "FORWARD_SAC": {
            "target_stage": "SAC_SHC_REVIEW",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Bureau Officer",
            "description": "EVC report submitted for Standing Appellate Review"
        },
        "DEFICIENCY_COMPLIANCE": {
            "target_stage": "COMPLIANCE_PENDING",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Regional Officer",
            "description": "EVC identified rectify-able deficiencies requiring time-bound compliance"
        },
        "RETURN": {
            "target_stage": "RETURNED_FOR_CLARIFICATION",
            "target_status": "RETURNED",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Institution",
            "description": "Institutional justification demanded on EVC report findings"
        }
    },
    "SAC_SHC_REVIEW": {
        "SAC_APPROVE": {
            "target_stage": "COMPLIANCE_PENDING",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["bureau", "admin"],
            "assigned_to": "Regional Officer",
            "description": "SAC endorsed approval subject to final compliance closure"
        },
        "APPROVE_FINAL": {
            "target_stage": "COMPLETED",
            "target_status": "COMPLETED",
            "allowed_roles": ["bureau", "admin"],
            "assigned_to": "Closed",
            "description": "Approval granted by Competent Authority / AICTE Council"
        },
        "REJECT_FINAL": {
            "target_stage": "COMPLETED",
            "target_status": "REJECTED",
            "allowed_roles": ["bureau", "admin"],
            "assigned_to": "Closed",
            "description": "Application rejected by Competent Authority following committee hearing"
        },
        "RETURN": {
            "target_stage": "RETURNED_FOR_CLARIFICATION",
            "target_status": "RETURNED",
            "allowed_roles": ["bureau", "admin"],
            "assigned_to": "Institution",
            "description": "Hearing Committee requested additional documentary proof"
        }
    },
    "COMPLIANCE_PENDING": {
        "COMPLIANCE_CLEAR": {
            "target_stage": "COMPLETED",
            "target_status": "COMPLETED",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Closed",
            "description": "All statutory compliance items verified. Approval Order issued."
        },
        "REQUIRE_SAC": {
            "target_stage": "SAC_SHC_REVIEW",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Bureau Officer",
            "description": "Compliance shortfall forwarded to SAC for determination"
        },
        "REJECT_FINAL": {
            "target_stage": "COMPLETED",
            "target_status": "REJECTED",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Closed",
            "description": "Rejected due to statutory non-compliance."
        },
        "RETURN": {
            "target_stage": "RETURNED_FOR_CLARIFICATION",
            "target_status": "RETURNED",
            "allowed_roles": ["officer", "bureau", "admin"],
            "assigned_to": "Institution",
            "description": "Submitted undertaking rejected; revised compliance requested"
        }
    },
    "RETURNED_FOR_CLARIFICATION": {
        "RESUBMIT": {
            "target_stage": "RE_SCRUTINY",
            "target_status": "IN_PROGRESS",
            "allowed_roles": ["institution", "admin"],
            "assigned_to": "Regional Officer",
            "description": "Institution submitted response and rectification for re-scrutiny"
        }
    }
}


def get_available_transitions(current_stage: str, user_role: str, application_type: str = "") -> List[Dict[str, Any]]:
    stage_rules = TRANSITION_RULES.get(current_stage, {})
    available = []
    is_new_prog = "new" in application_type.lower() or "programme" in application_type.lower()
    
    for action, rule in stage_rules.items():
        if user_role in rule["allowed_roles"] or user_role == "admin":
            # For new programme route, note if EVC is required before direct approval
            desc = rule["description"]
            if is_new_prog and action == "SCRUTINY_PASS":
                desc = "Primary scrutiny cleared (Note: EVC inspection required for New Programme before final approval)"
            available.append({
                "action": action,
                "target_stage": rule["target_stage"],
                "target_status": rule["target_status"],
                "description": desc
            })
    return available


def validate_transition(
    current_stage: str,
    action: str,
    user_role: str,
    reason: str = "",
    application_type: str = ""
) -> Dict[str, Any]:
    action_key = action.upper().strip()
    stage_rules = TRANSITION_RULES.get(current_stage, {})
    
    if action_key not in stage_rules:
        valid_actions = list(stage_rules.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Action '{action}' is not permitted from stage '{current_stage}'. Valid actions: {valid_actions or 'None'}"
        )
        
    rule = stage_rules[action_key]
    if user_role not in rule["allowed_roles"] and user_role != "admin":
        raise HTTPException(
            status_code=403,
            detail=f"Role '{user_role}' is not authorized to perform action '{action}' on stage '{current_stage}'"
        )
        
    if action_key == "RETURN":
        if not reason or len(reason.strip()) < 5:
            raise HTTPException(
                status_code=400,
                detail="A clear and specific justification (minimum 5 characters) is mandatory when returning an application for clarification."
            )
            
    if action_key == "RESUBMIT":
        if not reason or len(reason.strip()) < 3:
            raise HTTPException(
                status_code=400,
                detail="A response explanation is required when resubmitting an application."
            )
            
    return rule
