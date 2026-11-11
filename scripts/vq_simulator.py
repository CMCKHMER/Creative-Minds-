#!/usr/bin/env python3
"""Talk to me (voice-quest.html) engine simulator.

Mirrors the shipped bundle's executor (function `bu`), goal chain (`X`),
placement rules (`iy`), blocking (`go`), sizes (`ly/Bh`) and star scoring,
so every level's `solution` array can be validated offline.

Map legend (bundle `_h`): # wall  R rock  W water  T tree  S star  K key
D door  H house  C cat  G dog  F fish  B bone  E table  b bed  y sink
k food  L school  X box  V flower   (P = player start)
"""
import json, re, sys

BLOCKING = {"wall","rock","water","tree","house","cat","dog","table","bed",
            "sink","food","school","rabbit","bird","chest"}
PICKABLE = ["star","apple","key","fish","bone","ball","bread","carrot","cake","flower"]
RECEIVERS = {"cat","dog","rabbit","bird"}
LIKES = {"cat":"fish","dog":"bone","rabbit":"carrot","bird":"bread"}
ON_KINDS = {"table","box","bed"}
SIZE = {"small":0,"medium":1,"big":2}
CHAR_KIND = {"#":"wall","R":"rock","W":"water","T":"tree","S":"star","K":"key",
             "D":"door","H":"house","C":"cat","G":"dog","F":"fish","B":"bone",
             "E":"table","b":"bed","y":"sink","k":"food","L":"school","X":"box","V":"flower"}
DIRS = {"up":(0,-1),"down":(0,1),"left":(-1,0),"right":(1,0)}

def build(level):
    items, px, py, n = [], 0, 0, 0
    for y, row in enumerate(level["map"]):
        for x, ch in enumerate(row):
            if ch == "P": px, py = x, y
            elif ch in CHAR_KIND:
                items.append({"id": f"i{n}", "kind": CHAR_KIND[ch], "x": x, "y": y}); n += 1
    for e in level.get("extras") or []:
        it = {"id": f"i{n}", "kind": e["kind"], "x": e["x"], "y": e["y"]}
        for k in ("color","size","open"):
            if k in e: it[k] = e[k]
        items.append(it); n += 1
    return {"px": px, "py": py, "items": items, "bag": []}

def go(item):
    if item["kind"] == "door": return not item.get("open")
    return item["kind"] in BLOCKING

def adjacent(item_or_xy, w):
    return abs(item_or_xy["x"] - w["px"]) + abs(item_or_xy["y"] - w["py"]) == 1

def dist(item_or_xy, w):
    return abs(item_or_xy["x"] - w["px"]) + abs(item_or_xy["y"] - w["py"])

def bfs(w, level, target_cells):
    """Bundle `au`: BFS to any cell in target_cells; returns list of steps or None."""
    cols, rows = level["cols"], level["rows"]
    blocked_targets = {(t["x"], t["y"]) for t in target_cells}
    passable = lambda x, y: 0 <= x < cols and 0 <= y < rows and not any(
        i["x"] == x and i["y"] == y and go(i) for i in w["items"])
    start = (w["px"], w["py"])
    if start in blocked_targets: return []
    prev = {start: None}; q = [start]
    while q:
        nxt = []
        for (x, y) in q:
            for dx, dy in DIRS.values():
                nx, ny = x + dx, y + dy
                key = (nx, ny)
                if not (0 <= nx < cols and 0 <= ny < rows) or key in prev or not passable(nx, ny):
                    continue
                prev[key] = (x, y)
                if key in blocked_targets:
                    path = []; cur = key
                    while cur and cur != start:
                        path.insert(0, cur); cur = prev[cur]
                    return path
                nxt.append(key)
        q = nxt
    return None

def place_dest(w, relation, anchor, anchor2):
    """Bundle `iy`."""
    cols, rows = w["cols"], w["rows"]
    def free(x, y):
        return 0 <= x < cols and 0 <= y < rows and not any(
            i["x"] == x and i["y"] == y and go(i) for i in w["items"])
    if relation == "on":
        return {"x": anchor["x"], "y": anchor["y"]} if anchor["kind"] in ON_KINDS else None
    if relation in ("under", "in front of"):
        return {"x": anchor["x"], "y": anchor["y"] + 1} if free(anchor["x"], anchor["y"] + 1) else None
    if relation == "behind":
        return {"x": anchor["x"], "y": anchor["y"] - 1} if free(anchor["x"], anchor["y"] - 1) else None
    if relation == "between":
        if not anchor2: return None
        mx, my = (anchor["x"] + anchor2["x"]) / 2, (anchor["y"] + anchor2["y"]) / 2
        return {"x": int(mx), "y": int(my)} if mx == int(mx) and my == int(my) and free(int(mx), int(my)) else None
    # default: next to — adjacent free cell closest to player
    cands = [{"x": anchor["x"] + dx, "y": anchor["y"] + dy} for dx, dy in DIRS.values()]
    cands = [c for c in cands if free(c["x"], c["y"])]
    return min(cands, key=lambda c: dist(c, w)) if cands else None

def name(it):
    return (it.get("color") + " " if it.get("color") else "") + it["kind"]

ADVANCED = object()  # a goal progressed but the level is not finished yet

def is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)

KIND_WORDS = {"star","stars","start","treasure","apple","apples","key","keys","ki","door","doors","gate","dor",
              "cat","kitty","kitten","cats","dog","doggy","puppy","dogs","fish","fishes","bone","bones","tree","trees",
              "ball","balls","bowl","house","home","rock","stone","water","table","tables","desk","bed","sink",
              "school","class","classroom","box","flower","flowers","bread","carrot","carrots","cake","rabbit","bunny","bird","birds"}

def kind_count(seg):
    """Approximate the bundle's bp() target count for the between-rejoin rule."""
    return sum(1 for t in seg.split() if t in KIND_WORDS)

def run(level, verbose=False):
    """Execute level['solution']; returns (stars, mistakes, log). Returns None on hard fail."""
    w = build(level); w["cols"], w["rows"] = level["cols"], level["rows"]
    goals, gi, gprog, mistakes, score = level["goals"], 0, 0, 0, 0
    log = []

    def cur_goal():
        return goals[gi] if gi < len(goals) else None

    def goal_event(cmd, item=None):
        """Bundle `X` — chain goals; returns True if at least one goal advanced."""
        nonlocal gi, gprog, score
        advanced = False
        c = cmd
        for _ in range(8):
            g = cur_goal()
            if not g: break
            ok = False
            t = g["type"]
            if t == "collect":
                ok = (c == "pickup" and item and item["kind"] == g["kind"]
                      and (not g.get("color") or item.get("color") == g["color"]))
                if ok:
                    gprog += 1
                    done = gprog >= (g.get("count") or 1)
                    if not done: return ADVANCED  # progress but goal not finished
                    ok = done
            elif t == "open": ok = c == "open"
            elif t == "give": ok = (c == "give" and item and item[0]["kind"] == g["item"]
                                    and item[1]["kind"] == g["to"])
            elif t == "action": ok = c == "action" and item == g["action"]
            elif t == "place": ok = (c == "place" and item and item["kind"] == g["item"]
                                     and item.get("_relation") == g["relation"]
                                     and item.get("_anchor") == g["target"])
            elif t == "reach":
                ok = any(i["kind"] == g["kind"] and adjacent(i, w) for i in w["items"])
            if not ok: break
            advanced = True
            gi += 1; gprog = 0; score += 50
            c = None  # only first goal in chain consumes the command
        if gi >= len(goals):
            stars = 3 if mistakes <= 2 else (2 if mistakes <= 5 else 1)
            score += stars * 50
            log.append(f"DONE stars={stars} score={score}")
            return stars
        return ADVANCED if advanced else None

    def err(msg):
        nonlocal mistakes
        mistakes += 1
        log.append(f"  MISTAKE: {msg}")

    for line in level["solution"]:
        segs = re.split(r"\b(?:and then|and after that|after that|then|and|also)\b", line.lower())
        # Bundle `jo`: if the previous segment says "between" but parsed fewer
        # than two targets, the " and …" tail is re-joined into it.
        merged = []
        for s in segs:
            s = s.strip()
            if not s: continue
            if merged and "between" in merged[-1] and kind_count(merged[-1]) < 2:
                merged[-1] = merged[-1] + " and " + s
            else:
                merged.append(s)
        for seg in merged:
            res = exec_seg(w, level, seg, cur_goal, goal_event, err, log, verbose)
            if is_int(res):  # stars
                return res, mistakes, log
            if res is False and verbose:
                pass
    if gi < len(goals):
        return None, mistakes, log + [f"INCOMPLETE: stuck at goal {gi}: {goals[gi]['text']}"]
    return None, mistakes, log + ["INCOMPLETE: never finished"]

def exec_seg(w, level, seg, cur_goal, goal_event, err, log, verbose):
    toks = seg.replace("pickup", "pick up").split()
    # --- verbs (mirrors bundle `xy` order) ---
    def has(re_): return re.search(re_, seg) is not None
    # help
    if has(r"\b(help|hint|what do i do|i don't know|i dont know|what now)\b"):
        return None
    # place
    if has(r"\b(put|place|set|lay)\b") and not has(r"\bput (it |them )?down\b"):
        rel = ("in front of" if has(r"in front of") else "between" if has(r"between")
               else "under" if has(r"under|underneath|below|beneath")
               else "next to" if has(r"next to|beside|near|close to")
               else "behind" if has(r"behind|at the back of") else "on")
        # Mirror the bundle parser: pickable kinds are ITEMS, everything else
        # is an anchor (the exclusion list is exactly the pickable set).
        item_words, anchor_words = [], []
        for t in toks:
            base = {"trees":"tree","stars":"star","keys":"key","doors":"door","apples":"apple",
                    "balls":"ball","bones":"bone","fishes":"fish","cats":"cat","dogs":"dog",
                    "carrots":"carrot","flowers":"flower","tables":"table"}.get(t, t)
            if base in PICKABLE: item_words.append(base)
            elif base in KIND_WORDS - {"home","rock","stone","water","wall","gate","dor","ki","bowl",
                                       "start","treasure","stars","trees","keys","doors","apples",
                                       "balls","bones","fishes","cats","dogs","bread"} and base not in PICKABLE:
                # real anchors: tree table house box bed sink school food chest cat dog rabbit bird
                if base in {"tree","table","house","box","bed","sink","school","food","chest","cat","dog","rabbit","bird"}:
                    anchor_words.append(base)
        item_kind = (item_words or [None])[0]
        anchor_kind, anchor2_kind = (anchor_words or [None, None])[0], anchor_words[1] if len(anchor_words) > 1 else None
        g = cur_goal()
        if item_kind is None and g and g.get("type") == "place":
            item_kind = g.get("item")  # "put it between…" — item comes from the mission
        def color_of(word):
            i = toks.index(word)
            for j in range(max(0, i-3), i):
                if toks[j] in {"red","green","yellow","blue","purple","orange","pink","brown"}:
                    return toks[j]
            return None
        bag_item = next((b for b in w["bag"] if b["kind"] == item_kind), None) or (w["bag"][-1] if w["bag"] else None)
        if not bag_item: err(f"place: bag has no {item_kind}"); return False
        anchor = next((i for i in w["items"] if i["kind"] == anchor_kind), None)
        if not anchor: err(f"place: no {anchor_kind} on map"); return False
        anchor2 = next((i for i in w["items"] if i["kind"] == anchor2_kind), None) if anchor2_kind else None
        if not (adjacent(anchor, w) or dist(anchor, w) <= 2):
            err(f"place: too far from {anchor_kind} (dist={dist(anchor, w)})"); return False
        dest = place_dest(w, rel, anchor, anchor2)
        if not dest: err(f"place: no free spot {rel} the {anchor_kind}"); return False
        w["bag"] = [b for b in w["bag"] if b["id"] != bag_item["id"]]
        placed = dict(bag_item); placed.update(dest)
        placed["_relation"], placed["_anchor"] = rel, anchor_kind
        w["items"].append(placed)
        log.append(f"  place {name(bag_item)} {rel} {anchor_kind} @ {dest['x']},{dest['y']}")
        r = goal_event("place", placed)
        return r if is_int(r) else None
    # give
    if has(r"\b(give|gave|feed|fed|hand)\b"):
        recv = next((i for i in w["items"] if i["kind"] in RECEIVERS and adjacent(i, w)), None)
        if not recv: err("give: no animal next to you"); return False
        item_kinds = [t for t in toks if t in PICKABLE and t not in RECEIVERS]
        wanted = None
        for t in item_kinds:
            if any(b["kind"] == t for b in w["bag"]): wanted = t; break
        if wanted is None:
            wanted = LIKES.get(recv["kind"])
            if not any(b["kind"] == wanted for b in w["bag"]):
                err(f"give: bag has no {wanted} for the {recv['kind']}"); return False
        if LIKES.get(recv["kind"]) != wanted:
            err(f"give: {recv['kind']} does not want {wanted}"); return False
        item = next(b for b in w["bag"] if b["kind"] == wanted)
        w["bag"] = [b for b in w["bag"] if b["id"] != item["id"]]
        log.append(f"  give {name(item)} to {recv['kind']}")
        r = goal_event("give", (item, recv))
        return r if is_int(r) else None
    # open
    if has(r"\b(open|unlock|opened)\b"):
        door = next((i for i in w["items"] if i["kind"] == "door" and not i.get("open") and adjacent(i, w)), None)
        if not door: err("open: not next to a closed door"); return False
        key = next((b for b in w["bag"] if b["kind"] == "key"), None)
        if not key: err("open: no key in bag"); return False
        w["bag"] = [b for b in w["bag"] if b["id"] != key["id"]]
        door["open"] = True
        log.append("  open door")
        r = goal_event("open")
        return r if is_int(r) else None
    # pickup
    if has(r"\b(pick|picks|take|grab|get|collect|catch|fetch|bring)\b"):
        here = next((i for i in w["items"] if i["x"] == w["px"] and i["y"] == w["py"]
                     and i["kind"] in PICKABLE), None)
        if not here: err(f"pickup: nothing here to pick up @{w['px']},{w['py']}"); return False
        # kind words in the sentence
        said = [t for t in toks if t in PICKABLE]
        if said and said[0] != here["kind"]:
            err(f"pickup: said {said[0]} but this is {here['kind']}"); return False
        colors = {"red","green","yellow","blue","purple","orange","pink","brown"}
        said_color = next((t for t in toks if t in colors), None)
        g = cur_goal()
        # compare (biggest/smallest)
        cmp_word = None
        for t in toks:
            if t in ("biggest","largest","big","bigger","large","larger"): cmp_word = "biggest"; break
            if t in ("smallest","tiniest","small","smaller","tiny","little"): cmp_word = "smallest"; break
        goal_cmp = g.get("compare") if g and g.get("type") == "collect" else None
        eff_cmp = cmp_word or goal_cmp
        if eff_cmp:
            sizes = [SIZE.get(i.get("size","medium"),1) for i in w["items"] if i["kind"] == here["kind"]]
            target_v = max(sizes) if eff_cmp == "biggest" else min(sizes)
            if SIZE.get(here.get("size","medium"),1) != target_v:
                err(f"pickup: {here['kind']} is {here.get('size','medium')}, need the {eff_cmp}"); return False
        if g and g.get("type") == "collect" and g.get("color") and here["kind"] == g["kind"] and here.get("color") != g["color"]:
            err(f"pickup: mission wants the {g['color']} {g['kind']}"); return False
        if said_color and here.get("color") and said_color != here["color"]:
            err(f"pickup: said {said_color}, it is {here.get('color')}"); return False
        w["items"] = [i for i in w["items"] if i["id"] != here["id"]]
        w["bag"].append(here)
        log.append(f"  pick up {name(here)}")
        r = goal_event("pickup", here)
        return r if is_int(r) else None
    # drop
    if has(r"\b(drop|put down|leave)\b"):
        return None
    # goto
    if has(r"\b(go|walk|run|move|come|head|visit)\b") and not has(r"\bgo to (bed|sleep)\b") \
       and not has(r"\b(go|walk|move) (up|down|left|right|north|south|east|west)\b"):
        kinds = [t for t in toks if t in set(CHAR_KIND.values()) | {"ball","apple","bread","carrot","cake","flower","star","key"}]
        colors = {"red","green","yellow","blue","purple","orange","pink","brown"}
        color = next((t for t in toks if t in colors), None)
        kind = None
        for t in toks:
            base = {"trees":"tree","stars":"star","keys":"key","doors":"door","apples":"apple",
                    "balls":"ball","bones":"bone","fishes":"fish","cats":"cat","dogs":"dog"}.get(t, t)
            if base in {"tree","table","house","box","bed","school","sink","food","star","key",
                        "door","ball","apple","fish","bone","bread","carrot","cake","flower","cat","dog","rabbit","bird"}:
                kind = base; break
        if not level.get("allowGoto"):
            err("goto: level requires direction words"); return False
        cands = [i for i in w["items"] if i["kind"] == kind and (not color or i.get("color") == color)]
        if not cands: err(f"goto: cannot see {color or ''}{kind}"); return False
        # target cells: pickable kinds → own cell; else adjacent cells
        targets = []
        for t in cands:
            if t["kind"] in PICKABLE and t["kind"] not in ("star",):
                targets.append({"x": t["x"], "y": t["y"]})
            elif t["kind"] == "star":
                targets.append({"x": t["x"], "y": t["y"]})
            else:
                for dx, dy in DIRS.values():
                    x, y = t["x"] + dx, t["y"] + dy
                    if 0 <= x < level["cols"] and 0 <= y < level["rows"] and not any(
                            i["x"] == x and i["y"] == y and go(i) for i in w["items"]):
                        targets.append({"x": x, "y": y})
        path = bfs(w, level, targets)
        if path is None: err(f"goto: blocked path to {kind}"); return False
        for (x, y) in path: w["px"], w["py"] = x, y
        log.append(f"  goto {color or ''}{kind} -> {w['px']},{w['py']}")
        r = goal_event("moved")
        return r if is_int(r) else None
    # actions
    ACTIONS = [(r"\b(thank you|thanks|thank)\b","thanks"),(r"\b(hello|hi|hey|good morning|good afternoon|good evening|nice to meet you|howdy)\b","hello"),
               (r"\b(happy|glad|yay|excited|great|wonderful)\b","happy"),(r"\b(sad|unhappy|cry|crying|upset)\b","sad"),
               (r"\b(angry|mad|cross)\b","angry"),(r"\b(surprised|surprising|wow|whoa|amazing)\b","surprised"),
               (r"\b(tired|sleepy|exhausted)\b","tired"),(r"\b(wash|clean my hands|wash my hands)\b","wash"),
               (r"\b(brush)\b","brush"),(r"\b(eat|eating|breakfast|lunch|dinner)\b","eat"),
               (r"\b(read|reading|book|study)\b","read"),(r"\b(jump|jumps|jumping|hop|wake up)\b","jump"),
               (r"\b(dance|dancing|dances|boogie)\b","dance"),(r"\b(wave|waving|bye|goodbye)\b","wave"),
               (r"\b(sleep|nap|sleeping|go to bed|good night)\b","sleep"),(r"\b(spin|turn around|spinning)\b","spin"),
               (r"\b(clap|clapping|applause)\b","clap"),(r"\b(sing|song|singing)\b","sing")]
    for re_, act in ACTIONS:
        if re.search(re_, seg):
            log.append(f"  action {act}")
            r = goal_event("action", act)
            return r if is_int(r) else None
    # move
    dir_w = next((t for t in toks if t in DIRS or t in {"north":"up","south":"down","east":"right","west":"left"}), None)
    if dir_w:
        d = {"north":"up","south":"down","east":"right","west":"left"}.get(dir_w, dir_w)
        NUMS = {"one":1,"two":2,"three":3,"four":4,"five":5,"six":6,"seven":7,"eight":8,"nine":9,"ten":10}
        steps = 1
        for t in toks:
            if t.isdigit(): steps = int(t); break
            if t in NUMS: steps = NUMS[t]; break
        dx, dy = DIRS[d]
        for _ in range(max(1, min(steps, 10))):
            nx, ny = w["px"] + dx, w["py"] + dy
            if not (0 <= nx < level["cols"] and 0 <= ny < level["rows"]):
                err(f"move: edge of map going {d}"); return False
            blocker = next((i for i in w["items"] if i["x"] == nx and i["y"] == ny and go(i)), None)
            if blocker:
                err(f"move: {blocker['kind']} in the way going {d}"); return False
            w["px"], w["py"] = nx, ny
        log.append(f"  move {d} {steps} -> {w['px']},{w['py']}")
        r = goal_event("moved")
        return r if is_int(r) else None
    err(f"UNKNOWN segment: '{seg}'")
    return False

def main():
    html = open("public/voice-quest.html", encoding="utf-8").read()
    start = html.find("it=[{id:1,unit:1,")
    i = start + 3; depth = 0; end = None; instr = None; esc = False
    j = i
    while j < len(html):
        c = html[j]
        if instr:
            if esc: esc = False
            elif c == "\\": esc = True
            elif c == instr: instr = None
        else:
            if c in "\"'`": instr = c
            elif c == "[": depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0: end = j; break
        j += 1
    arr = html[i:end+1]
    # js object -> json: quote keys, !0 -> true
    js = re.sub(r"(\{|,)([A-Za-z_]\w*)\s*:", r'\1"\2":', arr)
    js = js.replace("!0", "true").replace("!1", "false")
    js = js.replace(",}", "}").replace(",]", "]")
    levels = json.loads(js)
    print(f"Loaded {len(levels)} levels\n")
    fails = 0
    for lv in levels:
        stars, mistakes, log = run(lv)
        ok = is_int(stars)
        status = f"OK  {stars}★" if ok else "FAIL"
        if not ok: fails += 1
        print(f"L{lv['id']:>2} [{status}] mistakes={mistakes}  {lv['title']}")
        if not ok or "-v" in sys.argv:
            for line in log: print("   ", line)
    print(f"\n{'ALL LEVELS SOLVE CLEAN ✔' if fails == 0 else f'{fails} LEVEL SOLUTION(S) BROKEN ✘'}")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
