import TradingSequenceScanner from "@/components/TradingSequenceScanner";

export default function Home() {
  return (
    <div>
      {/* WebSocketDebug can be uncommented for debugging */}
      {/* <WebSocketDebug /> */}
      <TradingSequenceScanner />
    </div>
  );
}
