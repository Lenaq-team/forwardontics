import { Badge, Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui"
import { TrendingUp } from "lucide-react"

const PlatformCard = () => {
    return (
        <Card className="@container/card">
            <CardHeader>
                <CardDescription>Total Revenue</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    $1,250.00
                </CardTitle>
                <CardAction>
                    <Badge variant="outline">
                        <TrendingUp />
                        +12.5%
                    </Badge>
                </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium">
                    Trending up this month <TrendingUp className="size-4" />
                </div>
                <div className="text-muted-foreground">
                    Visitors for the last 6 months
                </div>
            </CardFooter>
        </Card>
    )
}

export default PlatformCard;