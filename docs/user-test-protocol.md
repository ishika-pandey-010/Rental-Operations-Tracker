# Timed user test protocol

Measures the PRD's primary metric: median time for the standard task in a spreadsheet versus the app. Run in S3 after UAT exit. Raw results go in [`user-test.md`](user-test.md); nothing in the README is typed by hand.

## 1. Participants

- Five people (book seven in case of no-shows, R-10).
- Ideally people who rent out property; otherwise people comfortable with spreadsheets.
- Record only a participant code (P1–P5), their rental experience in one phrase, and spreadsheet comfort (low / medium / high). No names in git.

## 2. The standard task

Three units, one month. Each participant must:

1. Record November rent for units A, B and C (1,200.00 each; A and B pay in full, C pays 500.00).
2. Record that unit C paid another 300.00 a week later, and say what C still owes.
3. Unit B's tenant has moved out. Their deposit was 1,200.00; deduct 150.00 for cleaning. Record the refund and say how much is paid back.

**Correct answers:** C owes 400.00; B's refund is 1,050.00. A run with a wrong answer still counts for time, and the error is recorded (task-accuracy metric).

## 3. Conditions

| | Spreadsheet | App |
| --- | --- | --- |
| Starting state | `docs/user-test/baseline.xlsx`: the three units, tenants and October already filled in (`make baseline` rewrites it) | `make seed-user-test`: `usertest@rentalops.test` with the same units, tenants and October (run before each session; it resets the account) |
| Preparation | None (they know spreadsheets) | 10-minute walkthrough using `docs/user-guide.md`, then no help |
| Order | Alternate: P1, P3, P5 start with the spreadsheet; P2, P4 start with the app | |

Alternating order cancels out the learning effect of seeing the task twice.

## 4. Running a session (about 30 minutes)

1. Read the consent script: what we're measuring, that we're testing the tool and not them, that they can stop at any time, and that only a code is recorded.
2. Give the task sheet. Start the stopwatch when they say "ready"; stop it when they give both answers.
3. Don't help. If they're stuck for 2 minutes, note "assisted" and help with one sentence.
4. Repeat for the other condition.
5. Ask the three closing questions:
   - What was the slowest part in each?
   - Was there a moment you weren't sure the numbers were right?
   - Would you use the app for your own rentals? Why or why not?

## 5. What is recorded per session

Participant code, order, spreadsheet time (mm:ss), app time (mm:ss), answers given, correct (y/n) per condition, assisted (y/n), closing-question notes.

## 6. Analysis

- Report the **median** of each condition across five people, not the mean. Five is small and one slow run would skew a mean.
- Report all five raw times beside the medians.
- Report task accuracy as wrong answers per condition.
- State the limits: five users, one task, one session, and a walkthrough given only for the app.
