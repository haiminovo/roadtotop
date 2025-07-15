'use client'
import { useEffect, useState, useRef } from 'react';

export default function Chat() {
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const ws: any = useRef(null);

    useEffect(() => {
        // 连接 WebSocket 服务器
        ws.current = new WebSocket('ws://127.0.0.1:8080');

        ws.current.onopen = () => {
            console.log('WebSocket connected');
            setMessages(prev => [...prev, 'Connected to server']);
        };

        ws.current.onmessage = (event: { data: any; }) => {
            setMessages(prev => [...prev, `Server: ${event.data}`]);
        };

        ws.current.onclose = () => {
            setMessages(prev => [...prev, 'WebSocket disconnected']);
        };

        ws.current.onerror = (error: any) => {
            console.error('WebSocket error:', error);
            setMessages(prev => [...prev, 'WebSocket error']);
        };

        // 组件卸载时关闭 WebSocket
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);

    const sendMessage = () => {
        console.log('ws:', ws.current);
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(input);
            setMessages(prev => [...prev, `You: ${input}`]);
            setInput('');
        } else {
            alert('WebSocket is not connected.');
        }
    };

    return (
        <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 20, height: 200, overflowY: 'auto', border: '1px solid #ccc', padding: 10 }}>
                {messages.map((msg, idx) => (
                    <div key={idx}>{msg}</div>
                ))}
            </div>
            <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') sendMessage();
                }}
                style={{ width: '70%', marginRight: 10, padding: 8 }}
                placeholder="Type a message"
            />
            <button onClick={sendMessage} style={{ padding: '8px 16px' }}>Send</button>
        </div>
    );
}
