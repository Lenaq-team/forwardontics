"use client"

import { TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface RatingChartCardProps {
    data: Array<{ day: number; rating: number }>
}

const RatingChartCard = ({ data }: RatingChartCardProps) => {
    // Transform data for Recharts
    const chartData = [
        { day: "0", averageRating: 3 },
        { day: "15", averageRating: 3.5 },
        { day: "30", averageRating: 4.1 },
        { day: "45", averageRating: 4.2 },
        { day: "60", averageRating: 4.1 },
        { day: "75", averageRating: 4.3 },
        { day: "90", averageRating: 4.2 }
    ]

    const chartConfig = {
        averageRating: {
            label: "Avg Rating",
            color: "var(--chart-1)",
        },
    } satisfies ChartConfig

    return (
        <Card className="w-full h-full">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-center">AVERAGE RATING OVER TIME</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 h-[280px]">
                <ChartContainer config={chartConfig}>
                    <LineChart
                        data={chartData}
                        margin={{
                            left: 12,
                            right: 12,
                            bottom: 32,
                        }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="day"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => value.slice(0, 3)}
                            label={{
                                value: "Day",
                                position: "insideBottom",
                                offset: -10,
                                style: {
                                    fill: "var(--muted-foreground)",
                                    fontSize: 12,
                                },
                            }}
                        />


                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Line
                            dataKey="averageRating"
                            type="natural"
                            stroke="var(--color-rating)"
                            strokeWidth={2}
                            dot={{
                                fill: "var(--color-rating)",
                            }}
                            activeDot={{
                                r: 6,
                            }}
                        />
                    </LineChart>
                </ChartContainer>
                <div className="flex flex-col space-y-2 w-full">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Current Avg Rating</span>
                        <span className="font-semibold">4.2</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Highest Avg Rating</span>
                        <span className="font-semibold">4.3</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default RatingChartCard 