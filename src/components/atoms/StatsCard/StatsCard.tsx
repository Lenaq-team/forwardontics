import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { CheckCircle, MessageCircle } from "lucide-react"

interface StatsCardProps {
    achievements: string[]
    tips: string[]
}

const StatsCard = ({ achievements, tips }: StatsCardProps) => {
    return (
        <Card className="w-full h-full">
            <CardContent className="flex-1">
                <div className="space-y-4">
                    {/* Achievements */}
                    {achievements.map((achievement, index) => (
                        <div key={index} className="flex items-start space-x-3">
                            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{achievement}</span>
                        </div>
                    ))}

                    {/* Tips */}
                    {tips.map((tip, index) => (
                        <div key={index} className="flex items-start space-x-3">
                            <MessageCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{tip}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

export default StatsCard 