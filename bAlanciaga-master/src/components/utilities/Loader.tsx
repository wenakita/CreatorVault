const Loader = () => {
  return (
    <div className='flex  my-1 items-center justify-center h-[20px]'>
      <div
        className='animate-spin  rounded-full border-[4px] border-[#6CE7E4] border-t-[#555555] border-b-[#555555] border-l-[#555555] w-[25px] aspect-[1/1]'
        style={{ borderRadius: '50%', borderWidth: '20%' }}
      ></div>
    </div>
  )
}

export default Loader
