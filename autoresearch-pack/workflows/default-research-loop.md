# Default AutoResearch Loop

## 0. Safety and boundaries

- Do not run Paperclip reflection, Telegram delivery, or publishing during setup or ordinary research unless explicitly approved.
- Do not expose raw credentials.
- Do not overstate certainty.
- Keep facts, interpretations, hypotheses, and unknowns separate.

## 1. Intake

Collect:
- original question
- decision context
- target output
- time/market/source scope
- constraints and exclusions

If the user gives a broad question, proceed with reasonable default assumptions and label them.

## 2. Question refinement

Rewrite the question into:
- a primary research question
- 3 to 5 sub-questions
- inclusion/exclusion criteria
- expected output format

## 3. Broad scan

Use available tools in this order when relevant:
1. general web/search or browser inspection
2. official/primary sources
3. reputable reports/news/blogs
4. arxiv or academic sources for technical/scientific topics
5. youtube transcript tools for video-heavy topics
6. last30days/xurl for recent public/social reaction topics
7. specialized sources such as Polymarket when the question asks about expectations/probabilities

Record source table rows as you go.

## 4. Synthesis

Produce:
- facts
- interpretations
- hypotheses
- unknowns
- contradictions
- source limitations

## 5. Deepening plan

Propose 3 to 5 deepening angles.
Score each by:
- decision impact
- evidence gap
- time cost
- risk of being wrong

## 6. Deep dive

Run one focused loop on the selected/recommended angle.
If no angle is selected, choose the angle with highest decision impact and explain the assumption.

## 7. Final output

Use `templates/research-output-template.md`.
Always include:
- executive summary
- source table
- facts vs interpretation matrix
- deepening angles
- next loop decision

## 8. Next loop decision

Recommend exactly one default next step:
- `stop`
- `deepen`
- `broaden`
- `verify`
- `convert`
- `approval wait`

Then give 2 to 3 optional alternatives.

## 9. Stop conditions

Stop when:
- the decision is clear enough
- sources are exhausted for current budget
- confidence is too low and user input is needed
- external action requires approval

## 10. Conversion

If the user chooses `convert`, transform the research into one of:
- executive memo
- Paperclip decision report draft
- Obsidian note
- Telegram summary draft
- article/posting draft

External reflection/delivery/publishing remains approval-gated.
