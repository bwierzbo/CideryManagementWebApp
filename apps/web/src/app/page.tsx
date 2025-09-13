import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { 
  BarChart3, 
  ShoppingCart, 
  Grape, 
  Beaker, 
  Package, 
  Archive, 
  FileText, 
  ArrowRight,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2
} from "lucide-react"

const workflowSteps = [
  {
    icon: ShoppingCart,
    title: "Purchase",
    description: "Order apples from vendors",
    color: "bg-blue-50 text-blue-600 border-blue-200"
  },
  {
    icon: Grape,
    title: "Press", 
    description: "Extract juice from apples",
    color: "bg-purple-50 text-purple-600 border-purple-200"
  },
  {
    icon: Beaker,
    title: "Ferment",
    description: "Age and develop flavors",
    color: "bg-green-50 text-green-600 border-green-200"
  },
  {
    icon: Package,
    title: "Package",
    description: "Bottle and label products",
    color: "bg-amber-50 text-amber-600 border-amber-200"
  }
]

const quickActions = [
  {
    icon: BarChart3,
    title: "View Dashboard",
    description: "See your cidery's performance at a glance",
    href: "/dashboard",
    color: "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
  },
  {
    icon: ShoppingCart,
    title: "Record Purchase",
    description: "Add new apple purchases from vendors",
    href: "/purchasing",
    color: "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
  },
  {
    icon: Grape,
    title: "Start Press Run", 
    description: "Begin processing apples into juice",
    href: "/pressing",
    color: "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
  },
  {
    icon: FileText,
    title: "Generate Reports",
    description: "Create COGS and batch reports",
    href: "/reports",
    color: "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800"
  }
]

const stats = [
  {
    icon: TrendingUp,
    label: "Active Batches",
    value: "12",
    change: "+2 this month"
  },
  {
    icon: Package,
    label: "Bottles Ready",
    value: "1,234",
    change: "Ready to ship"
  },
  {
    icon: Users,
    label: "Active Vendors",
    value: "8",
    change: "Suppliers"
  },
  {
    icon: Clock,
    label: "Avg. Ferment Time",
    value: "45 days",
    change: "Current batches"
  }
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Grape className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Welcome to <span className="text-amber-600">CideryCraft</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Your complete cidery management system. Track everything from apple purchases 
              to bottled products with ease and precision.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg">
                <Link href="/dashboard" className="flex items-center">
                  Get Started <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-amber-200 text-amber-700 hover:bg-amber-50">
                <Link href="/reports">View Sample Reports</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <Card key={index} className="bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                      <p className="text-sm text-gray-500 mt-1">{stat.change}</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Icon className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Workflow Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Your Cidery Workflow</h2>
          <p className="text-lg text-gray-600">From apple to bottle, track every step of your process</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={index} className="relative">
                <Card className="bg-white shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 border-2 border-gray-100">
                  <CardContent className="p-6 text-center">
                    <div className={`w-16 h-16 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-4 border-2`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-600">{step.description}</p>
                    <div className="mt-4">
                      <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                    </div>
                  </CardContent>
                </Card>
                {index < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <p className="text-lg text-gray-600">Get started with the most common tasks</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => {
              const Icon = action.icon
              return (
                <Link key={index} href={action.href}>
                  <Card className="bg-white shadow-sm hover:shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer border-2 border-gray-100 hover:border-amber-200 group">
                    <CardContent className="p-6 text-center">
                      <div className={`${action.color} text-white w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-gray-600 text-sm">{action.description}</p>
                      <div className="mt-4 flex items-center justify-center text-amber-600 group-hover:text-amber-700">
                        <span className="text-sm font-medium">Get Started</span>
                        <ArrowRight className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}