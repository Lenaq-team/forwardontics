"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

interface ProgressCardProps {
    currentDays: number
    totalDays: number
    longestStreak: number
}

const ProgressCard = ({ currentDays, totalDays, longestStreak }: ProgressCardProps) => {
    const [animatedPercentage, setAnimatedPercentage] = useState(0)
    const [isAnimating, setIsAnimating] = useState(true)

    const percentage = Math.round((currentDays / totalDays) * 100)
    const circumference = 2 * Math.PI * 45 // radius = 45
    const strokeDasharray = circumference
    const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedPercentage(percentage)
            setIsAnimating(false)
        }, 100)

        return () => clearTimeout(timer)
    }, [percentage])

    return (
        <Card className="w-full h-full">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-center">30-DAY PROGRESS</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4 flex-1">
                {/* Circular Progress Chart */}
                <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                        {/* Background circle */}
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            stroke="#e5e7eb"
                            strokeWidth="8"
                            fill="none"
                        />
                        {/* Progress circle */}
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            stroke="#00a09a"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className={`transition-all duration-1000 ease-out ${isAnimating ? 'animate-pulse' : ''
                                }`}
                        />
                    </svg>

                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-center">
                            <div className={`text-2xl font-bold text-gray-900 transition-all duration-1000 ease-out ${isAnimating ? 'animate-pulse' : ''
                                }`}>
                                {Math.round(animatedPercentage)}%
                            </div>
                            <div className="text-sm text-gray-600">{currentDays}/{totalDays}</div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex flex-col space-y-2 w-full">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Current</span>
                        <span className="font-semibold">{currentDays} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Longest</span>
                        <span className="font-semibold">{longestStreak} days</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default ProgressCard 