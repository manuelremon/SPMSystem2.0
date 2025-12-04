export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        </div>
        <p className="text-gray-600 font-medium">Cargando...</p>
      </div>
    </div>
  )
}
