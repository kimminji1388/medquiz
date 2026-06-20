# Question Data Format

`data/questions.json` is the source of quiz questions.

Each question uses this format:

```json
{
  "id": "subject_section_001",
  "subject": "Subject name",
  "section": "Section name",
  "question": "Question text",
  "choices": ["Choice 1", "Choice 2", "Choice 3", "Choice 4", "Choice 5"],
  "answer": 1,
  "explanation": "Explanation text",
  "image": ""
}
```

Rules:

- `id` should use `subject_section_number`, for example `pharmacology_gi_001`.
- `answer` is the correct choice number, starting from 1.
- `choices` must contain at least 2 choices.
- `image` can be empty. When it is empty, the app hides the image area.
- If an item is broken, the app skips that item and keeps running.
