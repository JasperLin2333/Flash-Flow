"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Globe, Zap, Server, Shield, AlertTriangle, CheckCircle2, Terminal as TerminalIcon, RefreshCcw } from "lucide-react";
import { trackNetworkDiagnostic } from "@/lib/trackingService";

interface DiagnosticResult {
  latency: number;
  ttfb: number;
  downloadSpeed: number; // MB/s
  status: "success" | "warning" | "error";
  region: string;
  city: string;
  isp: string;
  ip: string;
}

interface LogEntry {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: string;
}

export default function DiagnosticsPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [
      {
        id: Math.random().toString(36).slice(2, 9),
        message,
        type,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 19),
    ]);
  };

  const runTest = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults(null);
    setLogs([]);
    addLog("🚀 启动全球接入诊断系统...", "info");

    try {
      // 1. IP & Geo Detection
      setProgress(10);
      addLog("正在定位接入节点...", "info");
      const geoResp = await fetch("https://api.ip.sb/geoip", { cache: 'no-cache' });
      const geoData = await geoResp.json();
      addLog(`定位成功: ${geoData.country} ${geoData.region} ${geoData.city} (${geoData.isp})`, "success");

      // 2. Latency (Ping)
      setProgress(30);
      addLog("正在测试骨干网延迟 (Latency)...", "info");
      const latencies: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await fetch("/api/health", { method: "HEAD", cache: "no-cache" });
        latencies.push(performance.now() - start);
        await new Promise(r => setTimeout(r, 200));
      }
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      addLog(`平均延迟: ${avgLatency.toFixed(2)}ms`, avgLatency > 200 ? "warning" : "success");

      // 3. TTFB (Time to First Byte)
      setProgress(60);
      addLog("正在测试 API 响应性能 (TTFB)...", "info");
      const startTTFB = performance.now();
      const apiResp = await fetch("/api/health", { cache: "no-cache" });
      await apiResp.json();
      const ttfb = performance.now() - startTTFB;
      addLog(`API 首包响应: ${ttfb.toFixed(2)}ms`, ttfb > 500 ? "warning" : "success");

      // 4. Asset Download Speed
      setProgress(80);
      addLog("正在测试静态资源下载带宽...", "info");
      const assetUrl = "/favicon.ico"; // Use favicon as a reliable test asset
      const startDown = performance.now();
      const downResp = await fetch(assetUrl, { cache: "no-cache" });
      const blob = await downResp.blob();
      const endDown = performance.now();
      const duration = (endDown - startDown) / 1000; // seconds
      const sizeMB = blob.size / (1024 * 1024);
      const speed = sizeMB / duration;
      addLog(`资源下载速度: ${speed.toFixed(2)} MB/s`, speed < 0.5 ? "warning" : "success");

      // Final Results
      setProgress(100);
      const finalStatus = (avgLatency > 300 || ttfb > 1000 || speed < 0.2) ? "error" : 
                         (avgLatency > 150 || ttfb > 500 || speed < 0.5) ? "warning" : "success";
      
      const resultData: DiagnosticResult = {
        latency: avgLatency,
        ttfb,
        downloadSpeed: speed,
        status: finalStatus,
        region: geoData.region || geoData.country,
        city: geoData.city,
        isp: geoData.isp,
        ip: geoData.ip,
      };

      setResults(resultData);
      addLog("✅ 诊断分析完成", "success");

      // Auto-track the results
      trackNetworkDiagnostic({
        ...resultData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      addLog(`❌ 诊断中断: ${error instanceof Error ? error.message : "未知网络错误"}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e2e2e4] font-mono p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-5xl mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3 mb-2">
            <Activity className="w-8 h-8 text-[#00f2ff] animate-pulse" />
            SYSTEM DIAGNOSTICS
          </h1>
          <p className="text-white/40 text-sm uppercase tracking-widest">
            Flash Flow Global Access Network Probe v1.0.4
          </p>
        </div>
        
        <button
          onClick={runTest}
          disabled={isRunning}
          className={`px-8 py-3 rounded-none border-2 transition-all duration-300 flex items-center gap-3 font-bold uppercase tracking-widest ${
            isRunning 
              ? "border-white/10 text-white/20 cursor-not-allowed" 
              : "border-[#00f2ff] text-[#00f2ff] hover:bg-[#00f2ff] hover:text-black shadow-[0_0_20px_rgba(0,242,255,0.3)]"
          }`}
        >
          {isRunning ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
          {isRunning ? "Testing..." : "Execute Probe"}
        </button>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Metrics */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard 
              label="Network Latency" 
              value={results ? `${results.latency.toFixed(1)}ms` : "--"} 
              subValue="Round Trip Time"
              status={results?.latency ? (results.latency > 200 ? "error" : results.latency > 100 ? "warning" : "success") : "idle"}
              icon={<Globe className="w-5 h-5" />}
            />
            <MetricCard 
              label="API Response" 
              value={results ? `${results.ttfb.toFixed(1)}ms` : "--"} 
              subValue="Time to First Byte"
              status={results?.ttfb ? (results.ttfb > 800 ? "error" : results.ttfb > 400 ? "warning" : "success") : "idle"}
              icon={<Server className="w-5 h-5" />}
            />
            <MetricCard 
              label="Transfer Speed" 
              value={results ? `${results.downloadSpeed.toFixed(2)} MB/s` : "--"} 
              subValue="Static Asset Throughput"
              status={results?.downloadSpeed ? (results.downloadSpeed < 0.2 ? "error" : results.downloadSpeed < 0.5 ? "warning" : "success") : "idle"}
              icon={<Zap className="w-5 h-5" />}
            />
            <MetricCard 
              label="Access Security" 
              value={results ? "SECURE" : "--"} 
              subValue="TLS 1.3 / Edge Optimized"
              status={results ? "success" : "idle"}
              icon={<Shield className="w-5 h-5" />}
            />
          </div>

          {/* Results Analysis */}
          <AnimatePresence>
            {results && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-8 border-l-4 ${
                  results.status === 'success' ? 'bg-green-500/5 border-green-500' :
                  results.status === 'warning' ? 'bg-orange-500/5 border-orange-500' :
                  'bg-red-500/5 border-red-500'
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  {results.status === 'success' ? <CheckCircle2 className="w-8 h-8 text-green-500" /> :
                   results.status === 'warning' ? <AlertTriangle className="w-8 h-8 text-orange-500" /> :
                   <AlertTriangle className="w-8 h-8 text-red-500" />}
                  <h3 className="text-2xl font-bold uppercase italic">
                    {results.status === 'success' ? "Connection Optimal" :
                     results.status === 'warning' ? "Performance Degraded" :
                     "Critical Latency Detected"}
                  </h3>
                </div>
                <p className="text-white/60 mb-6 leading-relaxed">
                  {results.status === 'success' ? 
                    "您的网络连接状况良好，Flash Flow 所有功能均可正常使用。生成流的速度应该在预期范围内。" :
                    results.status === 'warning' ?
                    "您的访问速度略慢，可能会在生成复杂 Flow 时感到明显的延迟或等待感。建议尝试刷新页面或检查代理设置。" :
                    "由于严重的跨境网络延迟，AI 生成功能可能会因超时而失败。我们已记录您的诊断数据，将优先针对您的地区优化线路。"}
                </p>
                <div className="grid grid-cols-2 gap-4 text-xs uppercase tracking-widest text-white/30">
                  <div>Region: <span className="text-white">{results.region}</span></div>
                  <div>ISP: <span className="text-white">{results.isp}</span></div>
                  <div>IP Addr: <span className="text-white">{results.ip}</span></div>
                  <div>Timestamp: <span className="text-white">{new Date().toLocaleTimeString()}</span></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Terminal Log */}
        <div className="bg-black/50 border border-white/10 h-[600px] flex flex-col overflow-hidden relative">
          <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40">
              <TerminalIcon className="w-3 h-3" />
              Live Console Log
            </div>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/50" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
              <div className="w-2 h-2 rounded-full bg-green-500/50" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 text-[11px] leading-relaxed scrollbar-hide">
            {logs.length === 0 && (
              <div className="text-white/10 italic py-4">Waiting for probe execution...</div>
            )}
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3">
                <span className="text-white/20 shrink-0">[{log.timestamp}]</span>
                <span className={`
                  ${log.type === 'success' ? 'text-green-400' : 
                    log.type === 'warning' ? 'text-orange-400' : 
                    log.type === 'error' ? 'text-red-400' : 
                    'text-white/60'}
                `}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>

          {isRunning && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5 overflow-hidden">
              <motion.div 
                className="h-full bg-[#00f2ff] shadow-[0_0_10px_#00f2ff]"
                initial={{ x: "-100%" }}
                animate={{ x: `${progress - 100}%` }}
                transition={{ type: "spring", damping: 20 }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subValue, status, icon }: { 
  label: string; 
  value: string; 
  subValue: string;
  status: "idle" | "success" | "warning" | "error";
  icon: React.ReactNode;
}) {
  const statusColors = {
    idle: "border-white/5 bg-white/[0.02] text-white/20",
    success: "border-green-500/30 bg-green-500/5 text-green-400",
    warning: "border-orange-500/30 bg-orange-500/5 text-orange-400",
    error: "border-red-500/30 bg-red-500/5 text-red-400",
  };

  return (
    <div className={`p-6 border-2 transition-all duration-500 flex flex-col gap-4 ${statusColors[status]}`}>
      <div className="flex justify-between items-start">
        <div className="p-2 bg-white/5 rounded-none">{icon}</div>
        <div className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 ${
          status === 'success' ? 'bg-green-500 text-black' :
          status === 'warning' ? 'bg-orange-500 text-black' :
          status === 'error' ? 'bg-red-500 text-black' : 'bg-white/10 text-white/40'
        }`}>
          {status}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest mb-1 opacity-50">{label}</div>
        <div className="text-3xl font-black tracking-tighter mb-1">{value}</div>
        <div className="text-[9px] uppercase tracking-widest opacity-30">{subValue}</div>
      </div>
    </div>
  );
}
