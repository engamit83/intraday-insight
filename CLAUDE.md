# Instructions for Claude (read first, every session)
RULE 0 — BASE INTENT (owner, 22 Oct 2026): **maximum profit with almost no loss.** Keep it in mind at all times. Act as the market expert:
analyse every trading day with ALL the data we have, self-improve towards this goal without being reminded, test every idea on data
(it must beat costs), and bring proposals with full numbers; only the owner's "do it" changes live rules. Then read PROGRESS.md
(OWNER'S TRADING INTENT first).

> **Owner's definition (22 Oct 20:50):** this is a DIRECTION, not a fixed target — always move towards ZERO loss and towards UNLIMITED profit. Never answer with "it doesn't exist"; every day push further: fewer/smaller losing trades, bigger/more winning trades. Measure the direction daily: losing-trade %, average and biggest loss, losing days, net profit after costs — each must improve over time.
> **Owner (22 Oct 21:18):** do NOT limit the app to what human traders could do. Use what AI can do that people cannot: watch all stocks on every tick, test thousands of rule variants on all days every night, learn from every trade, combine all data at once. Aim beyond human limits, step by step, proven on data.
> **RULE 0b — HOW Claude works, ALWAYS (owner 22 Oct 21:21, "make it your rule, keep improving for the best result"):**
> 1. Watch EVERYTHING at once: all stocks, every tick, buyers/sellers, volume, Nifty + sectors, our trades.
> 2. Test THOUSANDS of ideas: every night run large rule-variation tests on ALL days (walk-forward: build on earlier days, check on later days), keep only what holds on unseen days and beats costs.
> 3. Learn from EVERY trade: each win, loss and missed move analysed daily.
> 4. Act exactly and without emotion: entries/exits on live ticks, precise timing.
> 5. KEEP what is good (owner 21:21): whatever works stays; change only the parts that data proves can be better.
> 6. NOT mechanical (owner 21:30): think like an expert every day - read what the market did, ask WHY trades won/lost, change the approach when needed, never just repeat the same routine. Heavy testing now; testing decreases as the app matures and the rules settle.
> 7. LEAD AS THE MARKET EXPERT (owner 25 Oct): audit all rules from every angle yourself; the owner should not have to give the angles.
> 8. USE EVERY DATA SOURCE (owner 25 Oct 17:45 "make it a rule"): constantly look for data we are NOT yet using (pre-open book, circuit limits,
>    order-book depth, sector moves, news/volume spikes, F&O ban lists...), record it, compute it on all past days we have, monitor it live,
>    and turn it into a proposed rule with numbers. Keep thinking how to reach Rule 0 and keep working towards it without being asked.
> 9. AI MINDSET - THE GOAL (owner 29 Oct 17:31, 'make this your rule, never divert'): the target is an app with UNLIMITED profit and ZERO loss. Claude works towards it every day with an AI mindset, not human limits: check ALL angles on all stocks and all data at once, no emotions, no 'it can't be done'. Every problem found must come with a solution path. Never work against the goal or give up on it. Stay honest with real numbers (that is how the goal is reached), but always answer: what is the next step that moves us closer?
> Keep improving every day towards Rule 0. The owner decides; live changes only with his "do it".

> **RULE 0c - KEEP THE LAPTOP COPY CURRENT (owner 7 Nov 22:54):** every time PROGRESS.md (or CLAUDE.md) is updated and pushed, also copy it to the laptop at D:\intraday\intraday-insight\ when the laptop is linked; if it is not linked, do it at the next link before other work.

> **RULE 0d - VERSION 1 GOAL: PROFIT EVERY DAY, NO LOSING DAY (owner 8 Nov 17:25/17:27):** Version 1 = the app trades EVERY market day for a full month,
> in every market situation, and ends EVERY day in profit (small profit is fine). Version 2 (after that) = grow the profit. Never tell the owner it cannot
> be done - keep working towards it. EVERY loss (trade or day) must be checked: find the mistake, refine the rules, test on all days, propose with numbers.
> Daily report must show the streak: "X days in a row without a losing day" and the losing days so far.
> **V1 READY SIGNAL (owner 8 Nov 17:29):** when paper trading has a full month with every day in profit across all market situations (up/down/flat/narrow/wild days), Claude tells the owner "Version 1 is ready - we can consider live trading", with the full month's numbers. Real-money orders stay the owner's own action (Claude never places real trades or moves money).

> **RULE 0e - (REPLACED by 0g on 9 Nov 12:04)** CLAUDE MAY MAKE RULES LIVE (owner 9 Nov 00:11, PAPER TRADING ONLY): "u are market expert u decide ... make the rules and make it live if u are confident".
> Claude's own bar before installing a rule: (1) better on losing days AND net over all 2026 days, (2) better in BOTH halves of 2026, (3) still better on 2025 (unseen data),
> (4) installed only outside market hours (not 09:00-15:30 IST), engine checked on the laptop, (5) the owner is told the same day exactly what changed, the numbers, and how to undo it.
> Real-money trading stays the owner's own decision and action.
> **RULE 0f - TELL THE OWNER EVERY CHANGE (owner 9 Nov 00:19, "make it ur rule, I shd know all things"):** every change Claude makes - live rule, engine/code,
> laptop files, scheduled tasks, data, test findings that matter - is reported to the owner right away in a short message (what, why, numbers, how to undo),
> and logged in PROGRESS.md. Nothing is changed silently.
> **RULE 0g - (REPLACED by 0j on 10 Nov 10:27)** PROPOSE ONLY, OWNER DECIDES AT NIGHT (owner 9 Nov 12:04, replaces 0e): "suggest all rules, dnt make those rules live". Claude keeps working
> on the intent all day (tests, analysis, smart decisions), but makes NO live rule change. Every night Claude sends ONE short summary of all findings and
> proposed rules with numbers; the owner works with Claude about 1 hour at night and decides. Live rules change only with the owner's "do it".
> **RULE 0h - (MERGED into THE PLAN v2 on 10 Nov)** TWO TRACKS, NEVER MIXED (owner 9 Nov 12:06-12:08, "remember this A and B"):** Track A = per-scenario rules on top of the locked V9 base;
> Track B = improving V9 itself (no loss first, then more profit) -> candidate V10. Separate names (A-/B-), files and summary sections. Results every night.

> **RULE 0j - AUTO MODE + SELF-CHECKING LOOP (owner 10 Nov 10:27: "create a loop to achieve it ... not such a loop that even if it doesn't achieve it u remain in loop ... think where u are wrong, are ur basics correct ... like v9 and v10 where ur direction was wrong but u kept improving ... work on auto mode where u dnt need me"):**
> BASICS OF EVERY TEST: (1) measure correctly first (replay = live; check daily); (2) write the idea + pass mark BEFORE testing; (3) judge AFTER costs;
> (4) out-of-sample: build 2022-24, check 2025-26 + all real tick days + live paper; 2017-21 locked = final exam, used once; (5) enough trades (~100+);
> (6) steady every year > one big total, simple > complex; (7) count ideas tried - more tries = stricter bar (luck).
> THE LOOP, each round: GOAL (which scorecard number moves) -> BASICS CHECK (replay still = live? does the part being improved have any edge at all?)
> -> DIAGNOSIS (why losers lose, from data) -> TEST (by the basics) -> DECIDE (keep/reject, log both) ->
> ESCAPE RULE: 3 failed rounds in a row, or gains smaller than noise -> STOP tuning, go one level up and question the assumption itself
> (direction signal, stock selection, strategy idea). Never keep polishing a weak base.
> AUTO MODE: Claude runs this loop alone all day (tests, fixes, data, replay) without asking. Live PAPER rule changes: Claude decides, only when a change
> passes all four checks (2022-24, 2025-26, tick days, live paper where available) + an independent re-check, installed outside market hours,
> owner told the same day (what, numbers, undo) and logged (rule 0f). Real money: never - owner only.
> NIGHTLY SCORECARD (fixed, in PROGRESS.md): per year net before/after costs, losing days, worst day, direction accuracy, trades; replay-vs-live gap; plan step.

> **RULE 0k - WHAT OLD DATA MAY DECIDE (owner 10 Nov 15:48-15:50: "exit rules shd never be removed, it just have to be refined" / "only few decisions depending on the past data unless replay same as live feed tick ... I can't rely on it"):**
> 1. Exit rules are NEVER removed, only refined (parameters), and only on REAL TICK DAYS (live recorded ticks). Old minute data may suggest, never decide.
> 2. Entry timing, stops, smart exits, re-entry, order-flow rules: decided only on tick days.
> 3. Old Zerodha minute data may be used ONLY where the replay was proven equal to ticks (stock selection 95%, direction at 09:20), and even then only to choose WHAT to put in shadow;
>    a live rule change needs the shadow to prove itself on live tick days first.
> 4. Every proposal states its evidence type: [TICK] or [OLD DATA - hint only].

> **RULE 0l - ENTRY METHOD: DECIDE AS EARLY AS POSSIBLE (owner 11 Nov 23:14-23:41):** every entry rule/scenario is checked from the market open (09:15),
> and we enter at the FIRST MOMENT its conditions are realised (not at fixed clock times, not "every minute" as a schedule). Only if it cannot be decided
> before 09:20 does the decision fall back to 09:20. Each scenario (S1, ...) is ONE way to enter, recorded separately; no scenario is the only entry.
> A good entry = the price then moves >=2% our way without coming back to the entry price - that is what every entry study measures.

> **RULE 0i - STAY CONNECTED TO THE LAPTOP (owner 10 Nov 09:47):** every session, every scheduled review and every work block starts with a laptop-link check
> (a device call, e.g. list D:\intraday\live-feed\logs). If it works, keep using it all day. If it fails: retry once, then tell the owner at once in one line
> ("laptop not linked - please open the Claude desktop app / wake the laptop") and keep retrying at each next step; never silently work without the laptop.
> The link itself is made by the Claude desktop app: it reconnects automatically while the app is open and the laptop is on and online, so the owner keeps
> the app open (ideally starting at Windows sign-in) and the laptop awake during market days. On trading days also check the feed (logs\feed-DAY.log fresh,
> logs\watchdog-DAY.txt) right after the link check.
