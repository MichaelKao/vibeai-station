// tools/shutdowncheck.mjs 的子行程外殼。
//
// ⚠ 為什麼需要這一層：Windows **沒有真正的 POSIX 訊號**。
// child.kill('SIGTERM') 在 Windows 上走的是 TerminateProcess——行程當場消失，
// SIGTERM handler 一行都不會跑，所以在開發機上根本測不到關機流程。
// 正式站（Railway，Linux）收到的是真的 SIGTERM。
//
// 這一層讓測試可以用 IPC 叫子行程自己 process.emit('SIGTERM')，
// 走的是**和正式站完全相同的那一段 handler**，只有「訊號怎麼來的」不一樣。
// 驗的是我們寫的關機邏輯，不是作業系統的訊號傳遞。
await import('../src/server.js');
process.on('message', m => { if (m === 'term') process.emit('SIGTERM'); });
