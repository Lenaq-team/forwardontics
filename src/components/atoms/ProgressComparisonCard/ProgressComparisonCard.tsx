import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

interface ProgressComparisonCardProps {
    data: Array<{ day: number; userProgress: number; otherUsers: number }>
}

const ProgressComparisonCard = ({ data }: ProgressComparisonCardProps) => {
    const maxValue = 5
    const maxDay = Math.max(...data.map(d => d.day))

    const getBarHeight = (value: number) => {
        return (value / maxValue) * 100
    }

    const getXPosition = (day: number) => {
        return (day / maxDay) * 80 + 10
    }

    return (
        <Card className="w-full h-full">
            <CardHeader>
                <CardTitle className="text-lg font-semibold">YOUR PROGRESS VS OTHER USERS</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="relative w-full h-36">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Y-axis labels */}
                        {[0, 1, 2, 3, 4, 5].map(value => (
                            <text
                                key={value}
                                x="5"
                                y={100 - (value / maxValue) * 80}
                                className="text-xs fill-gray-500"
                                textAnchor="end"
                                dominantBaseline="middle"
                            >
                                {value}
                            </text>
                        ))}

                        {/* X-axis labels */}
                        {[15, 30, 45, 60, 75, 90].map(day => (
                            <text
                                key={day}
                                x={getXPosition(day)}
                                y="95"
                                className="text-xs fill-gray-500"
                                textAnchor="middle"
                            >
                                Day {day}
                            </text>
                        ))}

                        {/* Grid lines */}
                        {[0, 1, 2, 3, 4, 5].map(value => (
                            <line
                                key={value}
                                x1="10"
                                y1={100 - (value / maxValue) * 80}
                                x2="90"
                                y2={100 - (value / maxValue) * 80}
                                stroke="#e5e7eb"
                                strokeWidth="0.5"
                            />
                        ))}

                        {/* Bars */}
                        {data.map((point, index) => {
                            const x = getXPosition(point.day)
                            const barWidth = 3
                            const spacing = 1

                            return (
                                <g key={index}>
                                    {/* Other Users bar */}
                                    <rect
                                        x={x - barWidth - spacing / 2}
                                        y={100 - getBarHeight(point.otherUsers)}
                                        width={barWidth}
                                        height={getBarHeight(point.otherUsers)}
                                        fill="#22c55e"
                                        rx="1"
                                    />
                                    {/* User Progress bar */}
                                    <rect
                                        x={x + spacing / 2}
                                        y={100 - getBarHeight(point.userProgress)}
                                        width={barWidth}
                                        height={getBarHeight(point.userProgress)}
                                        fill="#3b82f6"
                                        rx="1"
                                    />
                                </g>
                            )
                        })}

                        {/* Legend */}
                        <g transform="translate(10, 10)">
                            <rect x="0" y="0" width="3" height="8" fill="#3b82f6" rx="1" />
                            <text x="6" y="6" className="text-xs fill-gray-600">Your Progress</text>
                            <rect x="0" y="12" width="3" height="8" fill="#22c55e" rx="1" />
                            <text x="6" y="18" className="text-xs fill-gray-600">Other Users</text>
                        </g>
                    </svg>
                </div>
            </CardContent>
        </Card>
    )
}

export default ProgressComparisonCard 