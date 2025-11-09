import BACK1 from '/back1.jpg'
import BACK2 from '/back2.jpg'
const Background = () => {
  return (
    <div className='w-full'>
      <div className='absolute z-0 top bg-center w-vdh h-full flex flex-row'>
        <div>
          <img src={BACK1} alt='BACK' className=' opacity-10 rounded-lg' />
        </div>
        <div>
          <img src={BACK2} alt='BACK' className=' opacity-10 rounded-lg' />
        </div>
      </div>
    </div>
  )
}

export default Background
