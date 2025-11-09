interface FeeItemProps {
  item: string
  onClick: () => void
  isActive: Boolean
}

const FeeItem: React.FC<FeeItemProps> = ({ item, isActive, onClick }) => {
  return (
    <div
      className={`p-2 text-white hover:bg-[#162377] hover:cursor-pointer ${
        isActive ? 'bg-[#3e1c8f]' : ''
      }`}
      onClick={onClick}
    >
      <div className=''>{item}</div>
      <div className='text-gray-400'>Best for stable pairs</div>
      {/* <div className='rounded-3xl border border-[rgba(41,59,183,0.52)] text-center w-fit px-2 font-bold text-sm'>
        Not Created
        #162377
      </div> */}
    </div>
  )
}

export default FeeItem
