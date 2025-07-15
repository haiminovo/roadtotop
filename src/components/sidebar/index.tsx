import React from 'react';

// 单条菜单项组件
const SidebarItem = ({ icon, menuName, progress }) => {
    const clampedProgress = Math.min(100, Math.max(0, progress));

    return (
        <div className="flex items-center h-16 bg-gray-100 p-2 rounded w-full mb-2">
            {/* 左侧 Icon */}
            <div className="w-12 h-12 flex items-center justify-center bg-white rounded shadow">
                {icon}
            </div>

            {/* 右侧进度条和文字 */}
            <div className="flex flex-col flex-grow ml-4">
                <div className="flex justify-between mb-1 text-sm font-medium text-gray-700">
                    <span>{menuName}</span>
                    <span>{clampedProgress}%</span>
                </div>
                <div className="w-full h-4 bg-gray-300 rounded overflow-hidden">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${clampedProgress}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

// Sidebar 组件
const Sidebar = ({ items }) => {
    return (
        <div className="w-64 p-4 bg-gray-50">
            {items.map((item, idx) => (
                <SidebarItem
                    key={idx}
                    icon={item.icon}
                    menuName={item.menuName}
                    progress={item.progress}
                />
            ))}
        </div>
    );
};

export default Sidebar;
