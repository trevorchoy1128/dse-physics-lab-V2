export const meta = {
  name: 'verify-loop',
  description: '閘 2 驗收循環：對一批模擬並行派出四個驗收員，失敗則由 sim-fixer 修正並按對應表重派，三輪封頂，超限自動寫升級報告',
  whenToUse: '無人值守地把一批已過閘 1 的模擬跑完閘 2。args: { simIds: ["projectile-independence", ...], maxRounds: 3, tasks: { "<simId>": ["學生任務1","任務2","任務3"] }, apparatus: { "<simId>": true } }',
  phases: [
    { title: '導出', detail: '每個模擬導出逐幀數據與截圖' },
    { title: '驗收', detail: '四個驗收員並行' },
    { title: '修正', detail: 'sim-fixer 按報告修正' },
    { title: '匯總', detail: '每個模擬的結果與升級' },
  ],
}

const simIds = (args && args.simIds) || []
const MAX = (args && args.maxRounds) || 3
const TASKS = (args && args.tasks) || {}
const APPARATUS = (args && args.apparatus) || {}
if (!simIds.length) throw new Error('args.simIds 為空')

const VERDICT = {
  type: 'object',
  properties: {
    passed: { type: 'boolean' },
    failures: { type: 'array', items: { type: 'string' } },
    reportPath: { type: 'string' },
  },
  required: ['passed', 'failures', 'reportPath'],
}
const FIX = {
  type: 'object',
  properties: {
    changedFiles: { type: 'array', items: { type: 'string' } },
    rerun: { type: 'array', items: { type: 'string' } },
    escalate: { type: 'boolean' },
    testsGreen: { type: 'boolean' },
    version: { type: 'string' },
  },
  required: ['changedFiles', 'rerun', 'escalate', 'testsGreen'],
}

// 改甚麼重派誰（references/loop.md 第 1 節）
const RERUN_BY_FILE = [
  [/model(\.test)?\.ts$/, ['physics-auditor', 'second-implementer']],
  [/plan\.ts$|Scene\.tsx$/, ['physics-auditor', 'apparatus-reviewer']],
  [/controls\.ts$/, ['physics-auditor', 'second-implementer', 'student-tester', 'apparatus-reviewer']],
  [/scenarios\.ts$|charts\.ts$|guide\.zh\.md$|quiz\.json$/, ['student-tester']],
]
const rerunFor = (files) => {
  const s = new Set()
  for (const f of files) for (const [re, roles] of RERUN_BY_FILE) if (re.test(f)) roles.forEach(r => s.add(r))
  return [...s]
}

const verifierPrompt = (role, simId, round) => {
  const common = `模擬：${simId}。第 ${round} 輪。報告寫到 reports/${simId}/${role === 'physics-auditor' ? 'physics-audit' : role === 'second-implementer' ? 'second-impl' : role === 'student-tester' ? 'student-test' : 'apparatus-review'}.md（覆蓋舊的）。`
  if (role === 'student-tester') {
    const tasks = TASKS[simId] || ['打開這個模擬並讓它播放', '改變一個參數，看畫面有甚麼不同', '找出畫面上任何一個數字是甚麼意思']
    return `${common}\n網址：http://localhost:5173/#/sim/${simId}\n老師叫你做的事：\n${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n最後以 JSON 回覆：passed（沒有「卡住」項目為 true）、failures（卡住的項目）、reportPath。`
  }
  return `${common}\n數據在 reports/${simId}/data/，截圖在 reports/${simId}/shots/，規格見 src/sims/${simId}/manifest.ts 的 spec 欄。\n最後以 JSON 回覆：passed、failures（不通過 / 不一致 / 必改的項目，每項一句）、reportPath。`
}

const roleLabel = { 'physics-auditor': '物理核數', 'second-implementer': '第二實作', 'student-tester': '學生試用', 'apparatus-reviewer': '儀器審核' }

const runVerifiers = (simId, roles, round) =>
  parallel(roles.map(role => () =>
    agent(verifierPrompt(role, simId, round), { agentType: role, label: `${roleLabel[role]}:${simId}#${round}`, phase: '驗收', schema: VERDICT })
      .then(v => ({ role, ...(v || { passed: false, failures: ['agent 無回覆'], reportPath: '' }) }))
  ))

const results = await pipeline(
  simIds,
  // 導出
  (simId) => agent(
    `模擬 ${simId}：執行 node tools/export-sim.mjs ${simId}；若開發伺服器未啟動，用 preview_start 啟動（.claude/launch.json 的 dev）；用瀏覽器開 http://localhost:5173/#/sim/${simId}，桌面尺寸與 iPad 直向（768×1024）各截圖一張到 reports/${simId}/shots/desktop.png 與 ipad.png，並對每個「試試看」情境各截一張。完成後回覆 "ok"。`,
    { label: `導出:${simId}`, phase: '導出', effort: 'low' }
  ),
  // 驗收 → 修正 → 重派，三輪封頂
  async (_ok, simId) => {
    let roles = ['physics-auditor', 'second-implementer', 'student-tester']
    if (APPARATUS[simId]) roles.push('apparatus-reviewer')
    const history = []
    for (let round = 1; round <= MAX; round++) {
      const verdicts = await runVerifiers(simId, roles, round)
      const failed = verdicts.filter(v => !v.passed)
      history.push({ round, verdicts })
      log(`${simId} 第 ${round} 輪：${failed.length ? failed.map(f => roleLabel[f.role]).join('、') + ' 不通過' : '全部通過'}`)
      if (!failed.length) return { simId, status: 'verified', rounds: round, history }
      if (round === MAX) break
      const fix = await agent(
        `模擬 ${simId}，第 ${round} 輪修正。不通過的角色與項目：\n${failed.map(f => `- ${roleLabel[f.role]}：${f.failures.join('；')}（報告 ${f.reportPath}）`).join('\n')}\n依 sim-fixer 定義修正，改完重新導出數據與截圖，最後以 JSON 回覆。`,
        { agentType: 'sim-fixer', label: `修正:${simId}#${round}`, phase: '修正', schema: FIX }
      )
      history[history.length - 1].fix = fix
      if (!fix || fix.escalate || !fix.testsGreen) {
        return { simId, status: 'escalated', rounds: round, reason: !fix ? 'fixer 無回覆' : fix.escalate ? 'fixer 判斷為規格歧義 / 反覆' : '修正後測試不綠', history }
      }
      const byFile = rerunFor(fix.changedFiles || [])
      roles = [...new Set([...(fix.rerun || []), ...byFile])].filter(r => r !== 'apparatus-reviewer' || APPARATUS[simId])
      if (!roles.length) roles = failed.map(f => f.role)   // 保底：至少重派原本不通過的角色
    }
    return { simId, status: 'escalated', rounds: MAX, reason: `三輪後仍不通過`, history }
  },
  // 升級報告
  async (r, simId) => {
    if (!r || r.status !== 'escalated') return r
    await agent(
      `模擬 ${simId} 經 ${r.rounds} 輪驗收仍未通過（原因：${r.reason}）。讀 reports/${simId}/ 內所有報告與 fix-log.md，按 .claude/skills/new-sim/references/loop.md 第 5 節格式寫 reports/${simId}/escalation.md，並把 content/catalogue.json 該模擬的 status 改為 "blocked"。歷史：${JSON.stringify(r.history.map(h => ({ round: h.round, failed: h.verdicts.filter(v => !v.passed).map(v => v.role) })))}。完成回覆 "ok"。`,
      { label: `升級:${simId}`, phase: '匯總' }
    )
    return r
  }
)

phase('匯總')
const summary = results.filter(Boolean).map(r => ({ simId: r.simId, status: r.status, rounds: r.rounds, reason: r.reason }))
log(`完成：${summary.filter(s => s.status === 'verified').length} 個通過，${summary.filter(s => s.status === 'escalated').length} 個升級`)
return summary
