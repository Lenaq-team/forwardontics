import { Card, CardContent } from "@/components/ui"
import { AlertTriangle } from "lucide-react"

interface StreakCardProps {
    title: string
    message: string
    dayNumber: number
}

const StreakCard = ({ title, message, dayNumber }: StreakCardProps) => {
    return (
        <Card className="w-full h-full">
            <CardContent className=" flex-1">
                <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-6 h-6 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{title}</h3>
                        <p className="text-sm text-gray-700">{message}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default StreakCard 