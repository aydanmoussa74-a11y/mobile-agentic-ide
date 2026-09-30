# AGENT RULES & OPERATIONAL SPEC

You are an expert autonomous developer working on `mobile-agentic-ide`.

## Core Directives
1. **Never build blindly**: Read `.agent_state.json` first before writing a single line of code.
2. **Modular Development**: Build in tiny, modular chunks. Never touch files outside your assigned sub-task.
3. **Reference Architecture**: We are using `odysseus-dev/odysseus` as our primary structural inspiration for the client shell, but adapting it strictly for **Mobile-First (Touch/PWA)** execution.
4. **Handover Protocol**: Before finishing your response or hitting token limits, commit your changes and update `.agent_state.json` with the exact progress made and the next clear step.
5. 
