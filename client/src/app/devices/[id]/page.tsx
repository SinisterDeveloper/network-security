import Link from "next/link"
import { notFound } from "next/navigation"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
const DEVICE_METADATA_URL = `${API_BASE}/client/metadata`
const DEVICE_MESSAGE_URL = `${API_BASE}/client/message`;

type DeviceMessage = {
  data?: string
  timestamp?: number
  hash?: string
  sender?: string
}

type DeviceDetail = {
  id: string
  name: string
  mac: string
  firmwareHash?: string
  registeredAt?: number
}

export default async function DeviceMessagesPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const metadataResponse = await fetch(DEVICE_METADATA_URL, { cache: "no-store" })
  if (!metadataResponse.ok) {
    notFound()
  }

  const devices = (await metadataResponse.json()) as DeviceDetail[]
  const device = devices.find((entry) => entry.id === id)
  if (!device) {
    notFound()
  }

  const messagesResponse = await fetch(`${DEVICE_MESSAGE_URL}?id=${encodeURIComponent(id)}`, { cache: "no-store" })
  if (!messagesResponse.ok) {
    notFound()
  }

  const messages = (await messagesResponse.json()) as DeviceMessage[]

  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col space-y-2">
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.3em] text-slate-300 underline-offset-4 transition hover:text-white"
          >
            ← Back to registry
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">{device.name ?? device.mac}</h1>
          <p className="text-sm text-slate-400">
            MAC: <span className="font-mono">{device.mac}</span>
          </p>
          {device.firmwareHash && (
            <p className="text-xs text-slate-500">
              Firmware Hash: <span className="font-mono">{device.firmwareHash}</span>
            </p>
          )}
          <p className="text-xs text-slate-500">
            Registered at:{" "}
            <span className="font-mono">
              {device.registeredAt ? new Date(device.registeredAt).toLocaleString() : "Unknown"}
            </span>
          </p>
        </header>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h2 className="text-sm uppercase tracking-[0.3em] text-slate-300">Messages</h2>
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-sm text-slate-400">
              No messages have been recorded for this device yet.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <article
                  key={`${message.timestamp ?? index}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"
                >
                  <div className="flex justify-between gap-4">
                    <p className="text-sm text-white break-words">{message.data ?? "Encrypted payload"}</p>
                    {message.sender && (
                      <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        {message.sender}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                    {message.timestamp && (
                      <span>{new Date(message.timestamp).toLocaleString()}</span>
                    )}
                    {message.hash && (
                      <span className="font-mono text-[10px]">{message.hash}</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
