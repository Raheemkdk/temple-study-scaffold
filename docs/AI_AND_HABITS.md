# Study task and habits design

The model's only weekend responsibility is drafting **one concise next study task** from an assignment title, a topic the student finds difficult, and available minutes. Avoid sending name, email, full Canvas feed, grades, or academic standing. Prompt for one active-recall or practice step, a time box, and a check of the answer. Offer a deterministic template if the model is unavailable, slow, or over budget. Label the source transparently.

The UI should reduce restart friction: show one upcoming task, a 5–25 minute focus option, and a concrete first step. Common obstacles include notification interruptions, social-media loops, switching between tabs, avoidance when behind, and trying to make a perfect plan before beginning. Let students silence distractions themselves and resume after an interruption without penalty; avoid surveillance, streak punishment, or moralizing language.

Owner 3 chooses a supported reasoning model and checks current pricing before enabling it. Set a hard output-token cap (for example 200–300), small input, timeout, server-side key, and a per-student daily request limit. Record approximate input/output token usage without raw sensitive prompts. Request a single response only when a student asks for help, not on every page load or sync. The target is one inexpensive request per study session; benchmark latency and cost with real provider usage before adding more calls.

The app should never ask the model to set a passing threshold or calculate the required grade. Do not represent generated study advice as academic counseling.
