import re

with open("/workspace/part3_game_single (6) (9)(9)(2)(6) (36).html", "r") as f:
    content = f.read()

# 1. 提取泵辅助函数
pump_helpers_pattern = re.compile(
    r'(const _pumpPickNeighborWater =.*?const _pumpIsPoweredSource = id => id === IDS\.SWITCH_ON \|\| id === IDS\.PLATE_ON;\n)',
    re.DOTALL
)
helpers_match = pump_helpers_pattern.search(content)
helpers_code = helpers_match.group(1)

# 2. 提取 _pumpSim 主体
pump_sim_pattern = re.compile(
    r'Game\.prototype\._pumpSim = function\(dtMs\) \{\n(.*?)\n\s*\};\n\s*Game\.prototype\.__tuPumpGcOptInstalled = !0;',
    re.DOTALL
)
sim_match = pump_sim_pattern.search(content)
sim_body = sim_match.group(1)

# 3. 把 sim_body 里的 this. 全部替换为 game.，把 dtMs 替换为 d
sim_body = sim_body.replace('this.', 'game.')
sim_body = sim_body.replace('dtMs', 'd')

# 4. 删除原来的辅助函数和 _pumpSim 定义
content = content[:helpers_match.start()] + '          Game.prototype.__tuPumpGcOptInstalled = !0;\n' + content[sim_match.end():]

# 5. 在 game:update:post 回调内部注入
inject_code = f"""
            // --- INLINED PUMP SIMULATION ---
            const _pumpPickNeighborWater = {helpers_code.split('const _pumpPickNeighborWater =')[1].split('const _pumpPickNeighborOutput =')[0].strip()}
            const _pumpPickNeighborOutput = {helpers_code.split('const _pumpPickNeighborOutput =')[1].split('const _pumpIsConductor =')[0].strip()}
            const _pumpIsConductor = {helpers_code.split('const _pumpIsConductor =')[1].split('const _pumpIsPoweredSource =')[0].strip()}
            const _pumpIsPoweredSource = {helpers_code.split('const _pumpIsPoweredSource =')[1].strip()}
            
            {sim_body.strip()}
            // --- END INLINED PUMP SIMULATION ---
"""
# 注意由于对齐缩进，我们可以把它放在 "function" == typeof game._pumpSim && game._pumpSim(d); 的位置
content = content.replace(
    '"function" == typeof game._pumpSim && game._pumpSim(d);',
    inject_code
)

with open("/workspace/part3_game_single (6) (9)(9)(2)(6) (36).html", "w") as f:
    f.write(content)

print("Rewrite successful!")
