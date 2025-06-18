'use client' // 必须标记为客户端组件

import { useEffect, useRef, useState } from 'react'

export default function Home() {
  const [messages, setMessages] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  // 初始化 WebSocket 连接
  useEffect(() => {
    const socketUrl = process.env.NODE_ENV === 'production'
      ? 'wss://your-production-url.com/ws'
      : 'ws://localhost:3001/ws'

    console.log('socketUrl:', socketUrl);

    socketRef.current = new WebSocket(socketUrl)

    socketRef.current.onopen = () => {
      console.log('open！');
      setIsConnected(true)
      addMessage('✅ 已连接到 WebSocket 服务器')
    }

    socketRef.current.onmessage = (event) => {
      addMessage(`📥 收到消息: ${event.data}`)
    }

    socketRef.current.onclose = () => {
      setIsConnected(false)
      addMessage('❌ 连接已关闭')
    }

    socketRef.current.onerror = (event) => {
      addMessage(`⚠️ 连接错误`)
      console.error('WebSocket error:', event)
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [])

  const addMessage = (message: string) => {
    setMessages((prev) => [...prev, message])
  }

  const sendMessage = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN && inputValue.trim()) {
      socketRef.current.send(inputValue)
      addMessage(`📤 发送消息: ${inputValue}`)
      setInputValue('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col min-h-screen p-6 bg-gray-950">
      <h1 className="text-2xl font-bold mb-4 text-white">WebSocket 测试</h1>

      <div className="flex items-center mb-4">
        <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-sm">
          {isConnected ? '已连接' : '未连接'}
        </span>
      </div>

      <div className="flex-1 bg-gray-800 rounded-lg p-4 mb-4 overflow-y-auto shadow">
        {messages.length === 0 ? (
          <p className="text-gray-500">暂无消息，连接后发送消息开始测试</p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="mb-2 last:mb-0">
              {msg.includes('✅') || msg.includes('❌') || msg.includes('⚠️') ? (
                <p className="text-sm">{msg}</p>
              ) : (
                <p className="text-sm bg-blue-50 p-2 rounded">{msg}</p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}  // 改为onKeyDown
          placeholder="输入消息..."
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!isConnected}
        />
        <button
          onClick={sendMessage}
          disabled={!isConnected || !inputValue.trim()}
          className={`px-4 py-2 rounded-lg ${isConnected && inputValue.trim() ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
        >
          发送
        </button>
      </div>
    </div>
  )
}
