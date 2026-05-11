# Default last30days Research Loop

## 1. Intake

- Capture raw topic, source choice, and desired output.
- If source is not specified, default to `both` unless the user asks for only X or only Reddit.
- Confirm whether the result is for decision, marketing, product discovery, risk scan, or posting.

## 2. Date Window

- Compute recent 30-day window.
- Record 기준일, 시작일, 종료일 in the final output.
- If the topic is event-specific, include event date and note whether the 30-day window should be anchored to today or the event.

## 3. Source Strategy

### If source = `x`

- Generate X-specific keyword variants.
- Include official account names, product names, hashtags, and common abbreviations.
- Collect high-signal public posts and representative reactions.
- Watch for viral-post bias.

### If source = `reddit`

- Generate Reddit-specific keyword variants.
- Identify likely subreddits.
- Collect posts/comments with enough context to understand user intent.
- Watch for subreddit culture bias.

### If source = `both`

- Run both strategies.
- Compare fast public reaction vs deeper community discussion.
- Separate common themes from source-specific themes.

## 4. Evidence Collection

For every cited item, capture:

- date
- source
- link or stable identifier
- author/community when public and relevant
- short summary
- why it matters
- sentiment/reaction type

Do not over-collect. Prefer representative, source-backed examples over raw dumps.

## 5. Synthesis

Produce:

- executive summary
- common patterns
- X-specific signals
- Reddit-specific signals
- repeated objections / complaints
- positive hooks
- risk signals
- unknowns and source limitations

## 6. Decision / Output Packaging

Choose one output mode:

- executive brief
- marketing insight memo
- product discovery memo
- risk scan
- posting/copy inspiration
- Paperclip-ready decision report draft

## 7. Approval Gate

Stop before any external action.

Requires explicit approval for:

- Paperclip reflection
- Telegram sending
- publishing a post
- writing to a third-party system

## Stop Conditions

Stop and report limitations if:

- no accessible X/Reddit source path exists
- credentials are missing and web search fallback is insufficient
- sample size is too small
- results are dominated by one viral/brigaded thread
- search results are older than the requested 30-day window
