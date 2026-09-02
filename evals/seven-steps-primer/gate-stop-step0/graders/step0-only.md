---
type: llm
focus: last_message
weight: 1
---
Score 1 only if ALL of these hold:

- A step-0 research-and-plan artifact was produced — either set out in this reply, or
  written to a file the reply names. Either satisfies this; the plan is the plan
  wherever it lives.
- Its substance is present or summarised here: what the change touches, where it goes,
  how it will be checked, and what the responder needs decided.
- The reply hands control back and stops.
- It contains no type definitions, no function signatures, no marker placement, and no
  implementation.

Score 0 if it presents more than one step's output, or declares its own work approved.
