import type { EcosystemAssetUrls } from "../../components/EcosystemScene";
import animalLifecycleAtlasUrl from "./assets/ecosystem-animal-lifecycle-atlas-v2.svg";
import animalProduceAtlasUrl from "./assets/ecosystem-animal-produce-atlas-v2.svg";
import aquariumUrl from "./assets/ecosystem-reference-aquarium.png";
import arrowUrl from "./assets/ecosystem-arrow.png";
import bubblesUrl from "./assets/ecosystem-bubbles.png";
import cropLifecycleAtlasUrl from "./assets/ecosystem-crop-lifecycle-atlas-v2.svg";
import fishLifecycleAtlasUrl from "./assets/ecosystem-fish-lifecycle-atlas-v2.svg";
import gardenUrl from "./assets/ecosystem-garden-bed-v3.png";
import gardenWateringCanUrl from "./assets/ecosystem-garden-watering-can-v3.png";
import nightAquariumLampUrl from "./assets/ecosystem-night-aquarium-lamp.png";
import nightGardenLampUrl from "./assets/ecosystem-night-garden-lamp.png";
import nightPastureLampUrl from "./assets/ecosystem-night-pasture-lamp.png";
import pastureUrl from "./assets/ecosystem-reference-pasture.png";
import reactionAnimalUrl from "./assets/ecosystem-reaction-animal.png";
import reactionCropUrl from "./assets/ecosystem-reaction-crop.png";
import reactionFishUrl from "./assets/ecosystem-reaction-fish.png";
import slotEquipmentUrl from "./assets/ecosystem-slot-equipment-v3.png";
import scarecrowUrl from "./assets/ecosystem-scarecrow.png";
import workbenchTableUrl from "./assets/ecosystem-workbench-table-v3.png";
import waterPlantUrl from "./assets/ecosystem-water-plant.png";

export const ECOSYSTEM_ASSET_URLS: EcosystemAssetUrls = {
  table: workbenchTableUrl,
  equipment: slotEquipmentUrl,
  aquarium: aquariumUrl,
  garden: gardenUrl,
  gardenWateringCan: gardenWateringCanUrl,
  animals: pastureUrl,
  arrow: arrowUrl,
  fishGold: fishLifecycleAtlasUrl,
  fishPearl: fishLifecycleAtlasUrl,
  fishStripe: fishLifecycleAtlasUrl,
  waterPlant: waterPlantUrl,
  bubbles: bubblesUrl,
  cropCarrot: cropLifecycleAtlasUrl,
  cropTomato: cropLifecycleAtlasUrl,
  cropCabbage: cropLifecycleAtlasUrl,
  cropOnion: cropLifecycleAtlasUrl,
  cropPumpkin: cropLifecycleAtlasUrl,
  cropLeafy: cropLifecycleAtlasUrl,
  animalChick: animalLifecycleAtlasUrl,
  animalRabbit: animalLifecycleAtlasUrl,
  animalAlpaca: animalLifecycleAtlasUrl,
  animalProduce: animalProduceAtlasUrl,
  reactionFish: reactionFishUrl,
  reactionCrop: reactionCropUrl,
  reactionAnimal: reactionAnimalUrl,
  nightAquariumLamp: nightAquariumLampUrl,
  nightGardenLamp: nightGardenLampUrl,
  scarecrow: scarecrowUrl,
  nightPastureLamp: nightPastureLampUrl,
};
