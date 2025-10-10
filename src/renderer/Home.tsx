import React from 'react';
import ViewPages from './ViewPages';

type BlenderExe = {
  path: string;
  name: string;
  title: string;
  icon: string;
};

interface HomeProps {
  selectedBlender: BlenderExe | null;
  onLaunch?: (b: BlenderExe) => void;
}

const Home: React.FC<HomeProps> = ({ selectedBlender, onLaunch }) => {
  return <ViewPages selectedBlender={selectedBlender} onLaunch={onLaunch} />;
};

export default Home;
