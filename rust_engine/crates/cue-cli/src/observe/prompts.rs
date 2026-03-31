#![allow(dead_code)]

pub(crate) fn description_realtime_instruction() -> &'static str {
    crate::lib_impl::description_realtime_instruction()
}

pub(crate) fn canvas_context_instruction() -> &'static str {
    crate::lib_impl::canvas_context_instruction()
}

pub(crate) fn intent_icons_instruction(mother: bool) -> String {
    crate::lib_impl::intent_icons_instruction(mother)
}
