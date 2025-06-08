import TradingSequenceScanner from "@/components/TradingSequenceScanner_backup";
import WebSocketDebug from "@/components/WebSocketDebug";

export default function Home() {
  return (
    <div>
      <WebSocketDebug />
      <TradingSequenceScanner />
    </div>
  );
}
