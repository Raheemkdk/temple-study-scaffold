# Grade calculation design

Canvas iCal does **not** provide course gradebook or grading category weights. Ask the student for their syllabus-based passing target, earned contribution to the course total, and remaining weight. With percentages in 0–100 units:

`required average on remaining work = (target − earned weighted points) / (remaining weight / 100)`

Example: target 70%, 42 percentage points already earned, 40% left yields 70% needed on the remaining work. `remaining weight = 0` means no remaining opportunity; ≤0 required means the target has already been met under the given assumptions; >100 required means mathematically unreachable. Round for display only. Validate totals and explain whether unknown grades or extra credit change the result. Never use a language model for arithmetic.

Temple's [undergraduate grading policy](https://bulletin.temple.edu/undergraduate/academic-policies/grades-grading/) states D− is passing generally, but General Education and many major requirements require at least C−. Individual syllabus cutoffs and program rules matter. UI copy should say **"based on the target and weights you entered"**, never assert that a student passed an actual course or predict official academic standing. Owner 2 adds boundary tests before connecting the UI.
