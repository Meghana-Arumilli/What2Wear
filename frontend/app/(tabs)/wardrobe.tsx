import { Text, View, StyleSheet, TouchableOpacity, Image, TextInput, ScrollView, Alert, Modal, Button, Dimensions, } from 'react-native';
import React, { useState, useRef, useEffect } from 'react';
import { Modalize } from 'react-native-modalize';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import DropDownPicker from 'react-native-dropdown-picker';

import { useNavigation, Stack } from 'expo-router'; 
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthUser } from '@/globalUserStorage';

import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';


// Defining the type for the navigation prop based on  routes
type RootStackParamList = {
  index: undefined;
  style: undefined; 
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'index'>;

// Define the props type
interface SearchBarProps {
    value: string; // Type for the value prop
    onChange: (text: string) => void; // Type for the onChange prop
    placeholder: string; // Type for the placeholder prop
  }

  interface WardrobeItem {
    id: string;
    imageUrl: string;
    name: string;
    category: string; // Define category as an array of strings
  }
  
  const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder }) => {
    return (
      <TextInput
        style={styles.searchBar}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#898989"
      />
    );
  };

// Define types for outfit and style board
type Outfit = {
    id: string;
    imageUrl: string;
    name: string;
  };
  
  
  interface StyleBoard {
    id: string;
    name: string;
    outfits: Outfit[];
  }

  

export default function WardrobeScreen() {
  const [activeView, setActiveView] = useState('inventory');
  const modalizeRef = useRef<Modalize>(null); // Ref for the bottom sheet menu
  const actionSheetRef = useRef<Modalize>(null); // Ref for the floating button menu
  const profileRef = useRef<Modalize>(null); // Ref for the profile modal
  const newItemRef = useRef<Modalize>(null); // Ref for the New Item modal
  const itemModalizeRef = useRef<Modalize>(null);  // Ref for the item details modal
  const outfitModalizeRef = useRef<Modalize>(null); // Ref for the outfit details modal

  const [profileImage, setProfileImage] = useState<string | null>(null); // Store user's profile image
  const [newItemImage, setNewItemImage] = useState<string | null>(null); // Store new item image
  const [itemDetails, setItemDetails] = useState<string>(''); // Store details about the new item

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const [selectedOutfit, setSelectedOutfit] = useState<any>(null);

  const user =useAuthUser();
  const userDisplayName = user?.displayName || 'User Name';

  // For style boards and choosing outfits for a new one
  const [isOutfitModalVisible, setOutfitModalVisible] = useState(false);
  const [isNameModalVisible, setNameModalVisible] = useState(false);
  // const [selectedOutfits, setSelectedOutfits] = useState<string[]>([]);
  const [selectedOutfits, setSelectedOutfits] = useState<Outfit[]>([]);
  const [outfitData, setOutfitData] = useState<any[]>([]);
  const [styleBoardName, setStyleBoardName] = useState('');
  const db = getFirestore();
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  // State variables for search bars
  const [searchInventory, setSearchInventory] = useState('');
  const [searchOutfits, setSearchOutfits] = useState('');
  const [styleBoards, setStyleBoards] = useState<StyleBoard[]>([]);
  const [searchStyleBoards, setSearchStyleBoards] = useState<string>('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedStyleBoard, setSelectedStyleBoard] = useState<StyleBoard | null>(null);


  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]); // State for fetched wardrobe items
  const [outfits, setOutfits] = useState<any[]>([]); // State for fetched outfits


  const onOpen = () => {
    modalizeRef.current?.open();
  };

  const onFloatingButtonPress = () => {
    actionSheetRef.current?.open(); // Open the floating button modal
  };

  const onProfilePress = () => {
    profileRef.current?.open(); // Open the profile modal
  };

  // Function to select a profile image from the gallery
  const pickProfileImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri); // Update the profile image
    }
  };

  // Function to add a new item
  const addNewItem = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        setNewItemImage(imageUri); // Set new item image locally

        // Open the New Item Modal to allow the user to enter details
        newItemRef.current?.open();
    }
  };

  // Adding a new function to handle saving the item details and uploading to Firestore
  const saveNewItem = async () => {
    // Check if the user is authenticated
    const auth = getAuth();
    const user = auth.currentUser;
    const storage = getStorage();
    const db = getFirestore();
    
    // Ensure that category, type, and color are not null or empty
    if (!selectedCategory || !selectedType || !selectedColor) {
        console.error("All item details must be selected");
    return;
    }

    if (user && newItemImage) {
        try {
          // Fetch and validate the image
          const response = await fetch(newItemImage);
          if (!response.ok) {
            throw new Error("Failed to fetch the image from the URI.");
          }

          const blob = await response.blob();

          // Create a storage reference for the image
          const imageRef = ref(storage, `users/${user.uid}/wardrobe/${Date.now()}.jpg`);
    
          // Upload image to Firebase Storage
          await uploadBytes(imageRef, blob);
    
          const downloadURL = await getDownloadURL(imageRef);

          // Save URL and item details to Firestore
          const docRef = await addDoc(collection(db, `users/${user.uid}/wardrobe`), {
            imageUrl: downloadURL,
            category: selectedCategory,
            type: selectedType,
            color: selectedColor,
            name: itemDetails,
            createdAt: new Date(),
          });

          console.log('Image uploaded and saved:', downloadURL);
          console.log("Document written with ID: ", docRef.id);

          // Close the modal after saving item 
          newItemRef.current?.close();
            Alert.alert("Success", "New item added to wardrobe!", [{ text: "OK" }]);

        } catch (error) {
          console.error('Error uploading image:', error);
          console.error("Error adding document: ", error);
        }
     }  else {
        console.error("User is not authenticated or no image selected.");
     }
  };

  const buttonNames = ['All', 'Outerwear', 'Tops', 'Bottoms', 'Footwear', 'Accessories'];
  
  // Fetching the wardrobe items from Firestore for inventory browsing 
  useEffect(() => {
    const fetchWardrobeItems = async () => {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        const db = getFirestore();

        if (currentUser) {
            try {
                const wardrobeCollection = collection(db, `users/${currentUser.uid}/wardrobe`);
                const wardrobeSnapshot = await getDocs(wardrobeCollection);
                const items: any[] = wardrobeSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setWardrobeItems(items); // Storing the user items in state
            } catch (error) {
                console.error('Error fetching wardrobe items:', error);
            }
        }
    };

    fetchWardrobeItems();
  }, []);

  useEffect(() => {
    const fetchOutfits = async () => {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        const db = getFirestore();

        if (currentUser) {
            try {
                const outfitsCollection = collection(db, `users/${currentUser.uid}/outfits`);
                const outfitsSnapshot = await getDocs(outfitsCollection);
                const fetchedOutfits: any[] = outfitsSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setOutfits(fetchedOutfits); // Storing the user outfits in state
            } catch (error) {
                console.error('Error fetching outfits:', error);
            }
        }
    };
    fetchOutfits();
  }, []);  // This will run once when the component mounts

  // Fetch style boards from Firestore
  useEffect(() => {
    const fetchStyleBoards = async () => {
      const db = getFirestore();
      const user = auth.currentUser; 
  
      if (!user) {
        console.log('User not logged in!');
        return;
      }
  
      try {
        // Reference the user's "styleBoards" collection
        const styleBoardsRef = collection(db, `users/${user.uid}/styleBoards`);
        const querySnapshot = await getDocs(styleBoardsRef);
  
        // Map Firestore documents to a style boards array
        const styleBoardsData: StyleBoard[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as StyleBoard[];
  
        setStyleBoards(styleBoardsData);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error fetching style boards:', error.message);
        } else {
          console.error('An unknown error occurred.');
        }
      }
    };
  
    fetchStyleBoards();
  }, []);
  

  const handleImagePress = (item: any) => {
    // Set the selected item and open the modal
    setSelectedOutfit(item);
    itemModalizeRef.current?.open();  // Open the modal with the item details
  };

  const ItemDetailsModal = () => (
    <Modalize ref={itemModalizeRef} adjustToContentHeight={true}>
      {selectedOutfit && (
        <View style={styles.itemModalContent}>
          <Text style={styles.outfitName}>{selectedOutfit.name}</Text>
          <Image source={{ uri: selectedOutfit.imageUrl }} style={styles.itemImage} />
          <Text style={styles.itemDetails}>
            {`Category: ${selectedOutfit.category}\nType: ${selectedOutfit.type}\nColor: ${selectedOutfit.color}`}
          </Text>
          {/* Button to delete item */}
          <TouchableOpacity onPress={() => deleteItem(selectedOutfit.id)} style={styles.itemDeleteButton}>
            <Text style={styles.deleteButtonText}>Delete Item</Text>
          </TouchableOpacity>
        </View>
      )}
    </Modalize>
  );

  const deleteItem = async (itemId: string) => {
    Alert.alert(
      "Are you sure?",
      "Do you really want to delete this item?",
      [
        {
          text: "No, don't delete",
          onPress: () => console.log('Delete canceled'),
          style: "cancel",
        },
        {
          text: "Yes, delete",
          onPress: async () => {
            try {
              const db = getFirestore();
              await deleteDoc(doc(db, `users/${getAuth().currentUser?.uid}/wardrobe`, itemId));
              Alert.alert('Success', 'Item deleted successfully!');
              // Update state to remove the item from the inventory
              setWardrobeItems(wardrobeItems.filter(item => item.id !== itemId));
              modalizeRef.current?.close(); // Close the modal after deletion
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ],
      { cancelable: false }
    );
  };
  

  // Handle outfit press to open the modal
  const handleOutfitPress = (outfit: any) => {
    setSelectedOutfit(outfit);
    outfitModalizeRef.current?.open();  // Open the modal with the outfit details
  };

  // Delete outfit from Firestore
  const deleteOutfit = async (outfitId: string) => {
    Alert.alert(
      "Are you sure?",
      "Do you really want to delete this outfit?",
      [
        {
          text: "No, don't delete",
          onPress: () => console.log('Delete outfit canceled'),
          style: "cancel",
        },
        {
          text: "Yes, delete",
          onPress: async () => {
            try {
              const db = getFirestore();
              await deleteDoc(doc(db, `users/${getAuth().currentUser?.uid}/outfits`, outfitId));
              Alert.alert('Success', 'Outfit deleted successfully!');
              setOutfits(outfits.filter(outfit => outfit.id !== outfitId)); // Update state to remove the deleted outfit
              modalizeRef.current?.close(); // Close the modal after deletion
            } catch (error) {
              console.error('Error deleting outfit:', error);
              Alert.alert('Error', 'Failed to delete outfit');
            }
          },
        },
      ],
      { cancelable: false }
    );
  };
  

  // Outfit details modal (Modalize component)
  const OutfitDetailsModal = () => (
    <Modalize ref={outfitModalizeRef} adjustToContentHeight={true}>
      {selectedOutfit && (
        <View style={styles.outfitModalContent}>
          <Text style={styles.outfitName}>{selectedOutfit.name}</Text>
          <Image source={{ uri: selectedOutfit.imageUrl }} style={styles.outfitImage} />
          {/* Button to delete outfit */}
          <TouchableOpacity onPress={() => deleteOutfit(selectedOutfit.id)} style={styles.outfitDeleteButton}>
            <Text style={styles.deleteButtonText}>Delete Outfit</Text>
          </TouchableOpacity>
        </View>
      )}
    </Modalize>
  );

  // Modal component for fetching outfits for new style board
  const fetchOutfitsForNewBoard = async () => {
    if (!userId) return;

    const outfitsRef = collection(db, `users/${userId}/outfits`);
    const outfitsSnapshot = await getDocs(outfitsRef);
    const outfitsList = outfitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setOutfitData(outfitsList);
  };

// Toggle outfit selection
const toggleOutfitSelection = (outfit: Outfit) => {
    // Check if outfit is already selected
    const isSelected = selectedOutfits.some(selectedOutfit => selectedOutfit.id === outfit.id);
  
    if (isSelected) {
      // If selected, remove from selectedOutfits
      setSelectedOutfits(selectedOutfits.filter(selectedOutfit => selectedOutfit.id !== outfit.id));
    } else {
      // If not selected, add to selectedOutfits
      setSelectedOutfits([...selectedOutfits, outfit]);
    }
  };
  
  

// Function to create and store a new style board
const handleCreateStyleBoard = async () => {
    // Ensure a name is provided for the style board
    if (!styleBoardName.trim()) {
      alert('Please enter a name for the style board.');
      return;
    }

    // Ensure selected outfits is not empty
    if (selectedOutfits.length === 0) {
      alert('Please select at least one outfit');
      return;
    }
  
    // Get Firestore instance and current user
    const db = getFirestore();
    const user = auth.currentUser; 

    if (!user) {
        alert('User not logged in!');
        return;
      }

    // Prepare the style board data
    const styleBoardData = {
      name: styleBoardName,  // Custom name entered by the user
      outfits: selectedOutfits.map(outfit => ({
        id: outfit.id,
        imageUrl: outfit.imageUrl, // we need the URL in order to display the outfit image
        name: outfit.name,
      }))
    };
  
    // Add the new style board to Firestore
    try {
      // Reference the user's "styleBoards" collection
      const styleBoardsRef = collection(db, `users/${user.uid}/styleBoards`);
    
      const docRef = await addDoc(styleBoardsRef, styleBoardData);
      console.log('Style board created with ID:', docRef.id); // Logging for testing purposes
      alert('Style board created successfully!');
      setSelectedOutfits([]);  // Clear selected outfits after creation
      setStyleBoardName('');  // Clear the style board name field
      setNameModalVisible(false); // Close the modal
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert('Error creating style board: ' + error.message);
      } else {
        alert('An unknown error occurred.');
      }
    }
  };
  

  const renderStyleBoardItem = ({ item }: { item: StyleBoard }) => (
    <TouchableOpacity
      style={styles.styleBoardItem}
      onPress={() => handleSelectStyleBoard(item)}
    >
      <View style={styles.imageContainer}>
        {item.outfits.slice(0, 2).map((outfit, index) => (
          <React.Fragment key={index}>
            <Image
              source={{ uri: outfit.imageUrl }}
              style={styles.styleBoardImage}
            />
            {index === 0 && item.outfits.length > 1 && (
              <View style={styles.imageSeparator} />
            )}
          </React.Fragment>
        ))}
        {item.outfits.length === 0 && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
      </View>
      <Text style={styles.styleBoardName}>{item.name || 'Unnamed Board'}</Text>
    </TouchableOpacity>
  );
  
  // StyleBoardModal Component
  const StyleBoardModal = () => (
    <Modal
      visible={isModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={closeModal}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          {selectedStyleBoard && (
            <>
              <Text style={styles.modalTitle}>{selectedStyleBoard.name}</Text>
              <FlatList
                data={selectedStyleBoard.outfits}
                keyExtractor={(item, index) => `${item.id || index}`}
                renderItem={renderOutfitItem}
                contentContainerStyle={styles.outfitList}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
  
  
    // Function to handle selecting a style board to view its contents
    const handleSelectStyleBoard = (styleBoard: StyleBoard) => {
        setSelectedStyleBoard(styleBoard);
        setIsModalVisible(true);
      };

    // Function to close the modal
    const closeModal = () => {
      setIsModalVisible(false);
      setSelectedStyleBoard(null);
    };


  // Render each outfit item in the modal
  const renderOutfitItem = ({ item }: { item: Outfit }) => (
    <View style={styles.outfitItem}>
      {item.imageUrl ? (
        <>
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.outfitOptionsImage}
          />
          <Text style={styles.outfitName}>{item.name || 'Unnamed Outfit'}</Text>
        </>
      ) : (
        <Text>No Image Available</Text>
      )}
    </View>
  );

  // function to confirm style board deletion 
  const confirmDeleteStyleBoard = (styleBoardId: string) => {
    Alert.alert(
      "Are you sure?",
      "Do you really want to delete this style board? This action cannot be undone.",
      [
        {
          text: "Cancel",
          onPress: () => console.log("Style board deletion canceled"),
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: () => deleteStyleBoard(styleBoardId),
        },
      ],
      { cancelable: false }
    );
  };

  // function to delete a style board
  const deleteStyleBoard = async (styleBoardId: string) => {
    try {
      const db = getFirestore();
      const userId = getAuth().currentUser?.uid;
  
      if (!userId) {
        throw new Error("User is not logged in");
      }
  
      // Delete the style board document
      await deleteDoc(doc(db, `users/${userId}/styleBoards`, styleBoardId));
  
      // Update local state
      setStyleBoards(styleBoards.filter(board => board.id !== styleBoardId));
  
      // Notify success and close the modal
      Alert.alert("Success", "Style board deleted successfully!");
      closeModal();
    } catch (error) {
      console.error("Error deleting style board:", error);
      Alert.alert("Error", "Failed to delete style board.");
    }
  };
  
  // constants for the inventory filter buttons
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All'); // state for selected category filter 
  const [filterItemCategory, setFilteredItemCategory] = useState<string>('All');


  // Function to handle button click and filter items
  const handleFilterChange = (category: string) => {
    const lowerCaseCategory = category.toLowerCase();
    console.log("Selected Category:", lowerCaseCategory);

    setSelectedCategoryFilter(category);

    if (lowerCaseCategory === 'all') {
        console.log("Showing all items");
        setFilteredItems(wardrobeItems); // Show all items
    } else {
        const filtered = wardrobeItems.filter((item: WardrobeItem) => {
            const itemCategoryLower = item.category.toLowerCase(); // New line to ensure case-insensitivity
            console.log("Item Category:", itemCategoryLower); // Debugging log
            return itemCategoryLower === lowerCaseCategory;
        });
        console.log("Filtered Items:", filtered); // Debugging log
        setFilteredItems(filtered);
    }
};



  // constants for search bars 
  const [filteredItems, setFilteredItems] = useState(wardrobeItems); // State for filtered items
  const [filteredOutfits, setFilteredOutfits] = useState(outfits); // state for filtered outfits
  const [filteredStyleBoards, setFilteredStyleBoards] = useState(styleBoards); // State for filtered style boards


  // Effect to filter outfits as search query changes
  useEffect(() => {
    const filtered = outfits.filter(outfit =>
      outfit.name.toLowerCase().includes(searchOutfits.toLowerCase())
    );
    setFilteredOutfits(filtered);
  }, [searchOutfits, outfits]);


  // Effect to filter style boards as search query changes
  useEffect(() => {
    const filtered = styleBoards.filter(styleBoard =>
      styleBoard.name.toLowerCase().includes(searchStyleBoards.toLowerCase())
    );
    setFilteredStyleBoards(filtered);
  }, [searchStyleBoards, styleBoards]);

  // Combined state for inventory view filter by category + search bar
  const [finalFilteredItems, setFinalFilteredItems] = useState<WardrobeItem[]>([]);

  // Combined effect to filter based on filterItemCategory and searchInventory
  useEffect(() => {
    console.log("Filtering with category:", filterItemCategory, "and search query:", searchInventory);

    const combinedFiltered = wardrobeItems.filter((item: WardrobeItem) => {
        const matchesCategory = filterItemCategory === 'All' || 
            item.category.toLowerCase() === filterItemCategory.toLowerCase();
        const matchesSearch = item.name.toLowerCase().includes(searchInventory.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    console.log("Final Filtered Items:", combinedFiltered);
    setFinalFilteredItems(combinedFiltered);
}, [wardrobeItems, filterItemCategory, searchInventory]);


// for synchronizing filteredItems when wardrobeItems or selectedCategoryFilter changes 
useEffect(() => {
    if (selectedCategoryFilter.toLowerCase() === 'all') {
        setFilteredItems(wardrobeItems); // Show all items when "All" is selected
    } else {
        const lowerCaseCategory = selectedCategoryFilter.toLowerCase();
        const filtered = wardrobeItems.filter((item: WardrobeItem) => {
            const itemCategoryLower = item.category.toLowerCase(); // Case-insensitive check
            return itemCategoryLower === lowerCaseCategory;
        });
        setFilteredItems(filtered);
    }
}, [wardrobeItems, selectedCategoryFilter]); // Run when wardrobeItems or filter changes



  // Rendering the inventory view
  const renderInventoryView = () => (
    <View>
        {/* Circular buttons for filtering options */}
        <View style={styles.circularButtonContainer}>
            {buttonNames.map((buttonName, index) => (
                <TouchableOpacity key={index} style={[styles.circularButton,
                    selectedCategoryFilter === buttonName ? styles.activeButton : null, // Add active button style if selected
                    ]}
                    onPress={() => handleFilterChange(buttonName)}
                >
                    <Text style={styles.buttonLabel}>{buttonName}</Text>
                </TouchableOpacity>
            ))}
        </View>

        <SearchBar value={searchInventory} onChange={setSearchInventory} placeholder="Search your inventory..."/>
        
        {/* Displaying the fetched user wardrobe inventory items */}
        <ScrollView>
          <View style={styles.gridContainer}>
            <FlatList
              data={filteredItems.length > 0 ? filteredItems : wardrobeItems}
              //data={finalFilteredItems} // using finalFilteredItems for combined filtering forr categories and search bar 
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleImagePress(item)}>
                    <Image source={{ uri: item.imageUrl }} style={styles.wardrobeImage}/>
                    <Text style={styles.itemName}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id} 
              numColumns={2} // Ensure two columns of items in inventory view
              contentContainerStyle={styles.flatListContent} 
            />
          </View>
        </ScrollView>

    </View>
);

  {/* Rendering the outfits view */}
  const renderOutfitsView = () => (
    <View>
        <SearchBar value={searchOutfits} onChange={setSearchOutfits} placeholder="Search your outfits..."/>
    
        <ScrollView>
            <View style={styles.gridContainer}>
                <FlatList
                    data={filteredOutfits} // using filteredOutfits here instead of outfits for the search funcationality 
                    renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => handleOutfitPress(item)}>
                            <Image source={{ uri: item.imageUrl }} style={styles.wardrobeOutfitsImage} />
                            <Text style={styles.itemName}>{item.name}</Text>
                        </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.flatListContent}
                />
            </View>
        </ScrollView>
    
    </View>
  );

  {/* Rendering the style boards view */}
  const renderStyleBoardsView = () => (
    <View style={styles.styleBoardsContainer}>
      <SearchBar value={searchStyleBoards} onChange={setSearchStyleBoards} placeholder="Search your style boards..."/>
      
      <ScrollView>
        <View style={styles.gridContainer}>
        <FlatList
          data={filteredStyleBoards} // using filteredStyleBoards instead of styleBoards for searching functionality
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.styleBoardList}
          renderItem={renderStyleBoardItem}
        />
        </View>
      </ScrollView>
    </View>
  );

  // Navigation reference for buttons to navigate to diff tabs 
  const navigation = useNavigation<NavigationProp>(); 

  // Function to handle navigation to the "Style" tab to create a new outfit 
  const handleCreateNewOutfit = () => {
    navigation.navigate('style'); 
  };
 
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
        <View style={styles.header}>
          
                {/* Profile Image */}
                <TouchableOpacity onPress={onProfilePress} style={styles.profileImageContainer}>
                    {profileImage ? (
                        <Image source={{ uri: profileImage }} style={styles.profileImage} />
                    ) : (
                    <View style={styles.placeholderImage}>
                        <Text style={styles.placeholderText}>𖨆</Text>
                    </View>
                    )}
          </TouchableOpacity>

          {/* User Name */}
          <Text style={styles.headerText}>{userDisplayName}</Text>

        
          {/* Menu Button */}
          <TouchableOpacity style={styles.menuButton} onPress={onOpen}>
            <Text style={styles.menuText}>⋮</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs to switch views */}
        <View style={styles.tabContainer}>
          <TouchableOpacity style={styles.tab} onPress={() => setActiveView('inventory')}>
            <Text
              style={[ styles.tabText, activeView === 'inventory' && styles.activeTabText]}>
              Inventory
            </Text>
            {activeView === 'inventory' && <View style={styles.activeTabUnderline} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={() => setActiveView('outfits')}>
            <Text
              style={[ styles.tabText, activeView === 'outfits' && styles.activeTabText ]}>
              Outfits
            </Text>
            {activeView === 'outfits' && <View style={styles.activeTabUnderline} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={() => setActiveView('style boards')} >
            <Text
              style={[ styles.tabText, activeView === 'style boards' && styles.activeTabText ]}>
              Style Boards
            </Text>
            {activeView === 'style boards' && <View style={styles.activeTabUnderline} />}
          </TouchableOpacity>
        </View>

        {/* Conditionally render the view based on user selection */}
        {activeView === 'inventory'
          ? renderInventoryView()
          : activeView === 'outfits'
          ? renderOutfitsView()
          : renderStyleBoardsView()}

        {/* Modalize for bottom sheet menu */}
        <Modalize ref={modalizeRef} snapPoint={300} modalHeight={400}>
          <View style={styles.menuContent}>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>Share Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>Get Help</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </Modalize>

        {/* Floating button */}
        <TouchableOpacity style={styles.floatingButton} onPress={onFloatingButtonPress}>
          <Text style={styles.floatingButtonText}>+</Text>
        </TouchableOpacity>

        {/* Modalize for the floating button menu */}
        <Modalize
          ref={actionSheetRef}
          adjustToContentHeight
          handlePosition="inside"
          overlayStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <View style={styles.menuContent}>
            <TouchableOpacity style={styles.menuOptionButton} onPress={addNewItem}>
              <Text style={styles.menuOptionText}>Add a New Item</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOptionButton} onPress={handleCreateNewOutfit}>
              <Text style={styles.menuOptionText}>Create a New Outfit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOptionButton} onPress={() => { setOutfitModalVisible(true); fetchOutfitsForNewBoard(); }}>
              <Text style={styles.menuOptionText}>Create a New Style Board</Text>
            </TouchableOpacity>
          </View>
        </Modalize>

        {/* Modalize for the user profile screen */}
        <Modalize
          ref={profileRef}
          adjustToContentHeight
          handlePosition="inside"
          overlayStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <View style={styles.profileContent}>
            <Text style={styles.profileTitle}>User Profile</Text>

            {/* User info */}
            <TouchableOpacity onPress={pickProfileImage}>
              <Image
                source={profileImage ? { uri: profileImage } : undefined}
                style={styles.profileImageLarge}
              />
            </TouchableOpacity>
            <Text style={styles.profileLabel}>Name: User Name</Text>
            <Text style={styles.profileLabel}>Username: user123</Text>
          </View>
        </Modalize>

        {/* Modal for Add a New Item */}
        <Modalize
          ref={newItemRef}
          adjustToContentHeight
          handlePosition="inside"
          overlayStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <View style={styles.scrollViewContent}>
            {newItemImage && (
              <Image
                source={{ uri: newItemImage }}
                style={styles.newItemImage}
              />
            )}

            <TextInput
              style={styles.newItemInput}
              value={itemDetails}
              onChangeText={setItemDetails}
              placeholder="Enter a name for this item..."
              placeholderTextColor={'#898989'}
            />

            {/* Category Dropdown */}
            <DropDownPicker
                open={categoryOpen}
                setOpen={setCategoryOpen}
                items={[
                  { label: 'Outerwear', value: 'outerwear' },
                  { label: 'Tops', value: 'tops' },
                  { label: 'Bottoms', value: 'bottoms' },
                  { label: 'Footwear', value: 'footwear' },
                  { label: 'Accessories', value: 'accessories' },
                ]}
                value={selectedCategory}
                setValue={setSelectedCategory}
                placeholder="Select a category"
                containerStyle={{ marginBottom: 15 }} // Adjust the spacing to prevent overlapping
                zIndex={3000} // Ensure correct stacking order
                zIndexInverse={1000}
              />

            {/* Type Dropdown */}
            <DropDownPicker
                open={typeOpen}
                setOpen={setTypeOpen}
                items={[
                  { label: 'Tee Shirt', value: 'teeshirt' },
                  { label: 'Tank Top', value: 'tanktop' },
                  { label: 'Shorts', value: 'shorts' },
                  { label: 'Pants', value: 'pants' },
                  { label: 'Sneakers', value: 'sneakers' },
                  { label: 'Sandals', value: 'sandals' },
                  { label: 'Boots', value: 'boots' },
                  { label: 'Hats', value: 'hats' },
                  { label: 'Headbands', value: 'headbands' },
                  { label: 'Jackets', value: 'jackets' },
                  { label: 'Sweaters', value: 'sweaters' },

                ]}
                value={selectedType}
                setValue={setSelectedType}
                placeholder="Select a type"
                containerStyle={{ marginBottom: 15 }} // Adjust the spacing to prevent overlapping
                zIndex={2000} // Ensure correct stacking order
                zIndexInverse={2000}
              />

            {/* Color Dropdown */}
            <DropDownPicker
                open={colorOpen}
                setOpen={setColorOpen}
                items={[
                  { label: 'Black', value: 'black' },
                  { label: 'White', value: 'white' },
                  { label: 'Gray', value: 'gray' },
                  { label: 'Red', value: 'red' },
                  { label: 'Orange', value: 'orange' },
                  { label: 'Yellow', value: 'yellow' },
                  { label: 'Green', value: 'green' },
                  { label: 'Blue', value: 'blue' },
                  { label: 'Purple', value: 'purple' },
                  { label: 'Pink', value: 'pink' },
                  { label: 'Brown', value: 'brown' },
                ]}
                value={selectedColor}
                setValue={setSelectedColor}
                placeholder="Select a color"
                containerStyle={{ marginBottom: 15 }} // Adjust the spacing to prevent overlapping
                zIndex={1000} // Ensure correct stacking order
                zIndexInverse={3000}
              />

            {/* Button to Add New Item */}
            <TouchableOpacity style={styles.saveButton} onPress={saveNewItem}>
              <Text style={styles.saveButtonText}>Add to Wardrobe</Text>
            </TouchableOpacity>

            </View>
            </Modalize>

            <ItemDetailsModal />
            <OutfitDetailsModal />
        
      {/* Outfit Selection Modal */}
      <Modal
        visible={isOutfitModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOutfitModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Style Board</Text>
            
            {/* Style Board Name Input */}
            <TextInput
              style={styles.input}
              placeholder="Enter a style board name..."
              placeholderTextColor={'#898989'}
              value={styleBoardName}
              onChangeText={setStyleBoardName}
            />
            
            {/* Outfits List */}
            <FlatList
                data={outfits}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.outfitList}
                renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.outfitItem,
                        selectedOutfits.some(selectedOutfit => selectedOutfit.id === item.id) && styles.selectedOutfitItem
                      ]}
                      onPress={() => toggleOutfitSelection(item)} // Pass the full outfit object here
                    >
                      <Image source={{ uri: item.imageUrl }} style={styles.outfitOptionsImage} />
                      <Text style={styles.outfitName}>{item.name}</Text>
                    </TouchableOpacity>
                )}
            />


            {/* Create Style Board Button */}
            <TouchableOpacity style={styles.addButton} onPress={handleCreateStyleBoard}>
              <Text style={styles.addButtonText}>Create New Style Board</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setOutfitModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Style Boards deatils modal to display outfit contents */}
      <Modal
      visible={isModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={closeModal}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          {selectedStyleBoard && (
            <>
              <Text style={styles.modalTitle}>{selectedStyleBoard.name}</Text>
              <FlatList
                data={selectedStyleBoard.outfits}
                keyExtractor={(item, index) => `${item.id || index}`}
                renderItem={renderOutfitItem}
                contentContainerStyle={styles.outfitList}
              />
              {/* Delete Button */}
              <TouchableOpacity
                onPress={() => confirmDeleteStyleBoard(selectedStyleBoard.id)}
                style={styles.boardDeleteButton}
              >
                <Text style={styles.deleteButtonText}>Delete Style Board</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
      

        </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  text: {
    color: '#000',
    fontSize: 18,
  },
  header: {
    width: '100%',
    height: 130,
    backgroundColor: '#3dc8ff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 35,
    marginBottom: 20,
    flexDirection: 'row',
    position: 'relative',
  },
  headerText: {
    color: '#000',
    fontSize: 32,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  profileImageContainer: {
    marginLeft: 10,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 30,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 30,
    color: '#fff',
  },
  profileImageLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginVertical: 10,
  },
  profileLabel: {
    fontSize: 18,
    marginVertical: 5,
    textAlign: 'center',
  },
  profileTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 15,
  },
  menuButton: {
    position: 'absolute',
    right: 20,
    top: 60,
  },
  menuText: {
    fontSize: 40,
    color: '#000',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#ccc',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
  },
  activeButton: {
    backgroundColor: '#3dc8ff',
  },
  activeButtonText: {
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tab: {
    paddingVertical: 10,
  },
  tabText: {
    color: '#888', // Default text color
    fontSize: 16,
  },
  activeTabText: {
    color: '#3dc8ff', // Active text color
    fontWeight: 'bold',
  },
  activeTabUnderline: {
    marginTop: 5,
    height: 2,
    backgroundColor: '#3dc8ff', // Teal underline for active tab
  },
  menuContent: {
    padding: 20,
  },
  menuItem: {
    paddingVertical: 15,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 18,
  },
  floatingButton: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3dc8ff',
    alignItems: 'center',
    justifyContent: 'center',
    right: 20,
    bottom: 30,
  },
  floatingButtonText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
  menuOptionButton: {
    paddingVertical: 15,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
  menuOptionText: {
    fontSize: 18,
  },
  profileContent: {
    padding: 20,
    alignItems: 'center',
  },
  newItemContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
  },
  newItemImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    marginBottom: 20,
  },
  itemDetailsInput: {
    width: '100%',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
  },
  newItemContent: {
    flex: 1,
    padding: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff', // White background for the modal
  },
  newItemLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333', // Dark color for the label
  },
  newItemInput: {
    width: '100%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#3dc8ff', 
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff', // White text color for the button
    fontSize: 16,
    fontWeight: 'bold',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  picker: {
    height: 40,
    width: 150,
    marginLeft: 10,
  },
  labelDropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  scrollViewContent: {
    padding: 45,
    alignItems: 'center',
    flexGrow: 1,
  },
  circularButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  circularButton: {
    width: 62, 
    height: 62, 
    borderRadius: 30, // To make the button circular
    backgroundColor: '#ffffff',
    borderColor: '#3dc8ff', 
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  buttonLabel: {
    color: '#3dc8ff',
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  searchBar: {
    alignSelf: 'center',
    height: 50,
    width: 350,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 20,
    paddingLeft: 50,
    paddingHorizontal: 5,
    marginVertical: 0,
    backgroundColor: '#fff',
  },
  gridContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center', // Center the items horizontally
    justifyContent: 'flex-start', // Center the items vertically
  },
  flatListContent: {
    alignItems: 'center', // Center content within FlatList
    paddingHorizontal: 10, 
    paddingBottom: 220,
  },
  wardrobeImage: {
    width: '50%', // Adjust width to fit two images in a row with spacing
    height: 150, // Set a fixed height, fixing the centering issue
    aspectRatio: 1,
    margin: 15, // Add margin for spacing of images 
    borderWidth: 3, 
    borderColor: 'black', 
    borderRadius: 10, 
  },
  wardrobeOutfitsImage: {
    width: '50%', // Adjust width to fit two images in a row with spacing
    height: 180, // Set a fixed height, fixing the centering issue
    aspectRatio: 0.8,
    margin: 30,
    marginBottom: 10,
    borderWidth: 3, 
    borderColor: 'black', 
    borderRadius: 10,
    resizeMode: 'contain',  // Ensures the entire image fits within the container 
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 3,
  },  
  itemModalContent: {
    padding: 20,
    alignItems: 'center',
    height: 400,
  },
  itemImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginTop: 14,
  },
  outfitModalContent: {
    padding: 20,
    alignItems: 'center',
    height: 600,
  },
  outfitName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 0,
  },
  outfitImage: {
    width: 80,
    height: 550,
    borderRadius: 10,
    marginTop: 30,
  },
  outfitOptionsImage: {
    width: 30,
    height: 200,
    borderRadius: 10,
    marginTop: 30,
  },
  outfitList: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  outfitDeleteButton: {
    marginTop: -80,
    padding: 10,
    backgroundColor: 'red',
    borderRadius: 5,
  },
  itemDeleteButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'red',
    borderRadius: 5,
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  boardDeleteButton: {
    marginTop: -80,
    padding: 10,
    backgroundColor: 'red',
    borderRadius: 5,
  },
  itemDetails: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 10,
},
selectedOutfitItem: { backgroundColor: '#cceeff' },
addButton: {
  backgroundColor: '#3dc8ff',
  padding: 15,
  borderRadius: 5,
  alignItems: 'center',
  marginTop: 20,
},
addButtonText: { color: '#fff', fontSize: 16 },
input: {
  height: 40,
  borderColor: '#ccc',
  borderWidth: 1,
  padding: 10,
  marginBottom: 20,
  borderRadius: 5,
},
modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
},
  modalTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 20,
    textAlign: 'center',
  },
  outfitItem: {
    width: '45%',
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 10,
    marginLeft: 10,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    height: Dimensions.get('window').height * 0.90,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    width: '30%',
  },
  cancelButtonText: {
    color: 'red',
    marginTop: 10,
  },
  styleBoardsContainer: {
    padding: 10,
  },
  styleBoardList: {
    paddingVertical: 10,
    paddingBottom: 220,
  },
  styleBoardItem: {
    width: '39%',
    height: 250,
    aspectRatio: 0.6,
    alignItems: 'center',
    paddingHorizontal: 10,
    margin: 20,
    marginBottom: 40,
    borderWidth: 3,
    borderColor: 'black',
    borderRadius: 10,
    resizeMode: 'cover',  // Ensures the entire image fits within the container 
  },
  styleBoardImage: {
    width: '20%',
    height: 215,
    borderRadius: 5,
    marginBottom: -35,
    resizeMode: 'cover',
  },
  imageSeparator: {
    width: 2, 
    backgroundColor: '#898989', 
    height: '70%', 
  },
  styleBoardName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  outfitGrid: {
    paddingVertical: 10,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0', 
    width: '48%', // Match image width
    height: 100, // Match image height
    borderRadius: 8,
  },
  imageContainer: {
    flexDirection: 'row', // Arrange images side-by-side
    justifyContent: 'space-between', // Space out the images
    alignItems: 'center',
    marginBottom: 10, // Space between images and the name
    width: '100%',
    paddingHorizontal: 0,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  closeButtonText: {
    color: '#007BFF',
    fontSize: 16,
  },
  
});
