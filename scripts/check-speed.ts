
import { performance } from 'perf_hooks';

/**
 * Flash Flow 自动化网络探测工具 v1.0
 * 用途：多轮测试到服务器的延迟，计算抖动与稳定性
 */

const TARGET_URL = 'https://www.flashflow.com.cn/api/health';
const ROUNDS = 10;
const DELAY_BETWEEN_ROUNDS = 500;

async function runBenchmark() {
    console.log(`\n🚀 开始自动化网络探测 [目标: ${TARGET_URL}]`);
    console.log(`📊 计划轮数: ${ROUNDS}\n`);

    const results: number[] = [];
    let successCount = 0;

    for (let i = 1; i <= ROUNDS; i++) {
        const start = performance.now();
        try {
            const resp = await fetch(TARGET_URL, { 
                method: 'HEAD',
                cache: 'no-cache',
                // Node fetch doesn't have a built-in timeout in the same way, but we can use AbortController
            });
            const duration = performance.now() - start;
            if (resp.ok || resp.status === 401 || resp.status === 404) {
                results.push(duration);
                successCount++;
                console.log(`  [Round ${i.toString().padStart(2, '0')}] ✅ Success | Latency: ${duration.toFixed(2)}ms`);
            } else {
                console.log(`  [Round ${i.toString().padStart(2, '0')}] ⚠️ Status ${resp.status} | Latency: ${duration.toFixed(2)}ms`);
            }
        } catch (error: any) {
            console.log(`  [Round ${i.toString().padStart(2, '0')}] ❌ Failed  | Error: ${error.message}`);
        }
        
        if (i < ROUNDS) {
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_ROUNDS));
        }
    }

    if (results.length === 0) {
        console.log('\n❌ 所有探测均失败，请检查网络连接。');
        return;
    }

    // 计算统计数据
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    
    // 计算抖动 (Jitter) - 相邻延迟差值的平均值
    let totalJitter = 0;
    for (let i = 1; i < results.length; i++) {
        totalJitter += Math.abs(results[i] - results[i-1]);
    }
    const jitter = totalJitter / (results.length - 1 || 1);

    console.log('\n' + '='.repeat(40));
    console.log('🏁 探测报告总结');
    console.log('='.repeat(40));
    console.log(`- 成功率: ${(successCount / ROUNDS * 100).toFixed(1)}%`);
    console.log(`- 平均延迟: ${avg.toFixed(2)}ms`);
    console.log(`- 最小延迟: ${min.toFixed(2)}ms`);
    console.log(`- 最大延迟: ${max.toFixed(2)}ms`);
    console.log(`- 网络抖动: ${jitter.toFixed(2)}ms`);
    
    // 健康分评价
    let score = 'EXCELLENT';
    let color = '\x1b[32m'; // Green
    if (avg > 300 || successCount / ROUNDS < 0.8) {
        score = 'CRITICAL';
        color = '\x1b[31m'; // Red
    } else if (avg > 150 || jitter > 50) {
        score = 'POOR';
        color = '\x1b[33m'; // Yellow
    }

    console.log(`- 综合评价: ${color}${score}\x1b[0m`);
    console.log('='.repeat(40) + '\n');
}

runBenchmark().catch(console.error);
